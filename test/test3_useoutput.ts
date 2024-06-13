import { MyMigDB, DSN } from "../src";
import { UserID } from "./id.ts";
import { TestTable } from "./mymig.ts";
import { Datetime } from "@nence/datetime";
import dotenv from "dotenv";

dotenv.config();
const thisDir = new URL("./", import.meta.url).pathname;

/**
 * assert
 *
 * @param t
 * @param a
 * @param b
 * @returns
 */
const eq = (t: string, a: any, b: any) => {
  if (Number.isNaN(a) && Number.isNaN(b)) return;
  if (a === b) {
    console.error(`\u001b[37m${t} ... \u001b[32mOK\u001b[37m`);
    return;
  }
  console.error(
    `${t} ... \u001b[31mfailed actual:${a} !== expected:${b}\u001b[37m`
  );
};

/**
 * mysql connection
 */
const dsn: DSN = {
  host: process.env.MYSQL_HOST ?? "localhost",
  port: parseInt(process.env.MYSQL_PORT ?? "3306"),
  user: process.env.MYSQL_USER ?? "user",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE,
};

/**
 * A class that resolves between implementation and database data types.
 */
class Database extends MyMigDB {
  // timezone setting
  private tzSave: string;
  private tzLoad: string;

  // constructor
  constructor(dsn: DSN, tzOutput: string) {
    super(dsn);
    this.tzSave = process.env.TZ ?? "Asia/Tokyo";
    this.tzLoad = tzOutput ?? this.tzSave;
  }

  // return timezone
  get timezone() {
    return this.tzSave;
  }

  // Wrap values read from mysql and so on.
  override convertFrom(tableName: string, columnName: string, value: any) {
    if (columnName === "id") {
      return new UserID(value);
    }
    if (value instanceof Date) {
      return new Datetime(value.getTime()).toTimezone(this.tzLoad);
    }
    return value;
  }

  // Convert values such as objects to types mysql can understand.
  override convertTo(value: any) {
    // UserID type to struing type
    if (value instanceof UserID) {
      return value.toString();
    }
    // timezone conversion
    else if (value instanceof Datetime) {
      return value.toTimezone(this.tzSave).format("y-m-dTh:i:s");
    }
    return value;
  }
}

/**
 * test main
 */
async function main() {
  const db = new Database(dsn, "Pacific/Gambier");
  const tt = new TestTable(db);

  // delete
  await tt.delete();
  eq("cleard", (await tt.select()).length, 0);

  // insert
  const id1 = (Math.floor(Math.random() * 100000000) + "").toString();
  const ea = `nence-${id1}@nekosapiens.com`;
  const res1 = await tt.insert({
    id: new UserID(id1),
    email: ea,
    createdAt: new Datetime("1970-01-01T00:00:00+00:00"),
  });
  eq("affectedRows1", res1.affectedRows, 1);

  // select
  const rows = await tt.select(tt.eq("id", id1));
  eq("row count", rows.length, 1);
  const row = rows[0];
  eq("userid", row.id.toString(), id1);
  eq("email", row.email, ea);
  eq("createdAt", row.createdAt.iso8601x, "1969-12-31T15:00:00-09:00");

  // update
  const res2 = await tt.update({ email: "test" }, tt.eq("id", id1));
  eq("affectedRows2", res2.affectedRows, 1);
  const rows2 = await tt.select(tt.eq("id", id1));
  eq("update email", rows2[0]["email"], "test");

  // upsert
  const dt1 = new Datetime("1970-01-02T03:04:05+09:00");
  const id2 = (Math.floor(Math.random() * 100000000) + "").toString();
  const ins = { id: new UserID(id2), email: "test1", createdAt: dt1 };
  const res3 = await tt.upsert(ins, ["email"]);
  eq("affectedRows3", res3.affectedRows, 1);
  const rows3 = await tt.select(tt.eq("id", id2));
  eq("upsert email(insert)", rows3[0]["email"], "test1");

  // upsert
  // https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html
  // 2 if an existing row is updated.
  const ins2 = { id: new UserID(id2), email: "test2", createdAt: dt1 };
  const res4 = await tt.upsert(ins2, ["email"]);
  eq("affectedRows4", res4.affectedRows, 2);
  const rows4 = await tt.select(tt.eq("id", id2));
  eq("upsert email(update)", rows4[0]["email"], "test2");
  eq("upsert createdAt", rows4[0]["createdAt"].time, dt1.time);

  // delete
  const res5 = await tt.delete(tt.eq("id", id1));
  eq("affectedRows5", res5.affectedRows, 1);
  const rows5 = await tt.select();
  eq("row count", rows5.length, 1);

  const res6 = await tt.delete(tt.eq("id", id2));
  eq("affectedRows6", res5.affectedRows, 1);
  const rows6 = await tt.select();
  eq("row count", rows6.length, 0);
}

await main();
process.exit(0);
