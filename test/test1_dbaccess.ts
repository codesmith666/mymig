import { MyMigDB, DSN } from "../src";
import dotenv from "dotenv";

dotenv.config();
const thisDir = new URL("./", import.meta.url).pathname;

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

const create = `
CREATE TABLE IF NOT EXISTS
test(
  id  BIGINT NOT NULL AUTO_INCREMENT,
  num INTEGER NOT NULL,
  str VARCHAR(32) NOT NULL,
  PRIMARY KEY(id)
);
`;

const insert = `INSERT INTO test(num,str) values(?,?)`;
const update = `UPDATE test SET num=num+1 WHERE id=1`;
const select = `SELECT * FROM test LIMIT 0,10`;

async function main() {
  const db = new MyMigDB(dsn);
  let r;
  r = await db.query(create);
  r = await db.query(insert, [Math.floor(Math.random() * 10000), "hoge"]);
  r = await db.query(update);
  r = await db.query(select);
  r = await db.query("SHOW TABLE STATUS;");
}

await main();
process.exit(0);
