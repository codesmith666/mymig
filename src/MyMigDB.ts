// deno-lint-ignore-file no-explicit-any
import mysql, {
  ConnectionOptions,
  Connection,
  ResultSetHeader,
} from "mysql2/promise";
// await configLogger({ enable: false });

export type DSN = ConnectionOptions;

/**
 * データベースアクセス
 */
export class MyMigDB {
  private dsn: DSN;
  private con: Connection = undefined!;
  /**
   * constructor
   * @param dsn
   */
  constructor(dsn: DSN) {
    this.dsn = dsn;
  }

  /**
   * get connection
   */
  async get() {
    if (!this.con) {
      if (this.dsn.connectionLimit) {
        this.con = await mysql.createConnection(this.dsn);
      } else {
        this.con = await mysql.createPool(this.dsn);
      }
    }
    return this.con;
  }

  /**
   * release connection;
   */
  async release() {
    if (this.con) {
      await this.con.end();
      this.con = undefined!;
    }
  }

  /**
   * クエリを実行する（一切変換しない）
   *
   * @param sql
   * @param params
   * @param isLog
   * @returns
   */
  async query(
    sql: string,
    params: any[] = [],
    isLog = false,
    selectTarget = "#query#"
  ) {
    //  パラメータを変換する（このときテーブル名、型名は使えない）
    for (let i = 0; i < params.length; i++) {
      params[i] = this.convertTo(params[i]);
    }
    // クエリ
    const client = await this.get();
    this.queryLog(sql, params, isLog);
    const [result, typedef] = await client.query(sql, params);

    // Select
    if (Array.isArray(result)) {
      for (const row of result as { [key: string]: any }[]) {
        for (const key of Object.keys(row)) {
          row[key] = this.convertFrom(selectTarget, key, row[key]);
        }
      }
      this.resultLog(result, isLog);
      return result as { [key: string]: any }[];
    }
    this.resultLog(result, isLog);
    return result as ResultSetHeader;
  }

  /**
   *  データベースから読み込んだ時の標準的変換動作。
   */
  convertFrom(_tableName: string, _columnName: string, value: any) {
    return value;
  }
  convertTo(value: any) {
    return value;
  }
  queryLog(sql: string, params: any[], isLog: boolean) {
    if (isLog) console.log({ sql, params });
  }
  resultLog(result: any, isLog: boolean) {
    if (isLog) console.log({ result });
  }
}

type Expression =
  | "eq"
  | "en"
  | "ne"
  | "lt"
  | "le"
  | "gt"
  | "ge"
  | "isNull"
  | "isNotNull"
  | "isTrue"
  | "isFalse"
  | "isUnknown"
  | "isNotTrue"
  | "isNotFalse"
  | "isNotUnknown"
  | "between"
  | "notBetween";

export type Exp<COLUMN> = { key: COLUMN; exp: Expression; val?: any };
export type Where<COLUMN> = Exp<COLUMN> | (Where<COLUMN> | "AND" | "OR")[];

/**
 * テーブルアクセスクラス
 */
export class Table<TYPE extends object, COLUMNS> {
  protected tableName: string;
  protected database: MyMigDB;
  /**
   * コンストラクタ
   *
   * @param tableName
   * @param database
   */
  constructor(tableName: string, database: MyMigDB) {
    this.tableName = tableName;
    this.database = database;
  }

  /**
   * 式生成用関数
   *
   * @param key
   * @param val
   * @returns
   */
  eq(key: COLUMNS, val: any): Exp<COLUMNS> {
    return { key, exp: "eq", val };
  }
  en(key: COLUMNS, val: any): Exp<COLUMNS> {
    return { key, exp: "en", val };
  }
  ne(key: COLUMNS, val: any): Exp<COLUMNS> {
    return { key, exp: "ne", val };
  }
  lt(key: COLUMNS, val: any): Exp<COLUMNS> {
    return { key, exp: "lt", val };
  }
  le(key: COLUMNS, val: any): Exp<COLUMNS> {
    return { key, exp: "le", val };
  }
  gt(key: COLUMNS, val: any): Exp<COLUMNS> {
    return { key, exp: "gt", val };
  }
  ge(key: COLUMNS, val: any): Exp<COLUMNS> {
    return { key, exp: "ge", val };
  }
  isNull(key: COLUMNS): Exp<COLUMNS> {
    return { key, exp: "isNull" };
  }
  isNotNull(key: COLUMNS): Exp<COLUMNS> {
    return { key, exp: "isNotNull" };
  }
  isTrue(key: COLUMNS): Exp<COLUMNS> {
    return { key, exp: "isTrue" };
  }
  isFalse(key: COLUMNS): Exp<COLUMNS> {
    return { key, exp: "isFalse" };
  }
  isUnknown(key: COLUMNS): Exp<COLUMNS> {
    return { key, exp: "isUnknown" };
  }
  isNotTrue(key: COLUMNS): Exp<COLUMNS> {
    return { key, exp: "isNotTrue" };
  }
  isNotFalse(key: COLUMNS): Exp<COLUMNS> {
    return { key, exp: "isNotFalse" };
  }
  isNotUnknown(key: COLUMNS): Exp<COLUMNS> {
    return { key, exp: "isNotUnknown" };
  }
  between(key: COLUMNS, from: any, till: any): Exp<COLUMNS> {
    return { key, exp: "between", val: [from, till] };
  }
  notBetween(key: COLUMNS, from: any, till: any): Exp<COLUMNS> {
    return { key, exp: "notBetween", val: [from, till] };
  }

  /**
   * こんな配列を渡すと
   * [eq("id","hoge"),"AND",[eq("foo","bar"),"OR",lt("updated_at","2022-03-26")]],
   *
   * こんな風にレンダリングする
   * id=? and (foo=? or updated_at<?)
   * ["hoge","bar","2022-03-26"]
   */
  where(where: Where<COLUMNS>, params: any[]) {
    let result = ""; //  生成された式
    const sqlexp = {
      eq: "= ?",
      en: "<=> ?",
      ne: "!= ?",
      lt: "< ?",
      le: "<= ?",
      gt: "> ?",
      ge: ">= ?",
      isNull: "IS NULL",
      isNotNull: "IS NOT NULL",
      isTrue: "IS TRUE",
      isNotTrue: "IS NOT TRUE",
      isFalse: "IS FALSE",
      isNotFalse: "IS NOT FALSE",
      isUnknown: "IS UNKNOWN",
      isNotUnknown: "IS NOT UNKNOWN",
      between: "BETWEEN ? AND ?",
      notBetween: "NOT BETWEEN ? AND ?",
    };

    const w = (where: Where<COLUMNS>) => {
      // 配列だったらANDやORでつながる
      if (where instanceof Array) {
        result += "(";
        for (const v of where) {
          if (v === "AND" || v === "OR") {
            result += " " + v + " ";
          } else {
            w(v);
          }
        }
        result += ")";
      } // オブジェクトだったらそれは式
      else if (where instanceof Object) {
        const { exp, key, val } = where;
        // 式の処理
        result += "`" + key + "` " + sqlexp[exp];
        // 引数の処理
        switch (exp) {
          // 引数1個系
          case "eq":
          case "en":
          case "ne":
          case "lt":
          case "le":
          case "gt":
          case "ge":
            params.push(val);
            break;
          // 引数2個系
          case "between":
          case "notBetween":
            params.push(val[0]);
            params.push(val[1]);
            break;
        }
      } else {
        result += where + " ";
      }
    };

    w(where);
    return result;
  }

  /**
   * select
   * 何もないときは空のリストを返す
   *
   * @param where
   * @param orderBy
   * @param isLog
   * @returns
   */
  async select(
    where: Where<COLUMNS> | undefined = undefined,
    orderBy = undefined,
    isLog = false
  ) {
    const params: any[] = [];
    const exp = where ? " WHERE " + this.where(where, params) : "";
    const sql = "SELECT * FROM `" + this.tableName + "`" + exp;
    const sql2 = orderBy ? `${sql} ORDER BY \`${orderBy}\`` : sql;
    // クエリ
    const results = await this.database.query(
      sql2,
      params,
      isLog,
      this.tableName
    );
    return results as Required<TYPE>[];
  }

  /**
   * get first row
   *
   * @param where
   * @param isLog
   * @returns
   */
  async findOne(where: Where<COLUMNS>, isLog = false) {
    const rows = await this.select(where, undefined, isLog);
    const row = rows[0]!;
    if (row) {
      return row;
    }
    return undefined;
  }

  /**
   * insert
   *
   * @param insert
   * @param isLog
   * @returns
   */
  async insert(insert: TYPE, isLog = false) {
    const keys: string[] = [];
    const vals: string[] = [];
    const params: any[] = [];

    for (const key of Object.keys(insert)) {
      keys.push("`" + key + "`");
      vals.push("?");
      const val = insert[key as keyof typeof insert];
      params.push(val);
    }
    const k = keys.join(",");
    const v = vals.join(",");
    const t = this.tableName;
    const sql = "INSERT INTO `" + t + "`(" + k + ") values(" + v + ")";

    return (await this.database.query(
      sql,
      params,
      isLog,
      this.tableName
    )) as ResultSetHeader;
  }

  /**
   * update
   *
   * @param update
   * @param where
   * @param isLog
   * @returns
   */
  async update(update: TYPE, where: Where<COLUMNS>, isLog = false) {
    const kvs: string[] = [];
    const params: any[] = [];
    for (const key of Object.keys(update)) {
      kvs.push("`" + key + "`=?");
      const val = update[key as keyof typeof update];
      params.push(this.database.convertTo(val));
    }
    const k = kvs.join(",");
    const t = this.tableName;
    const exp = this.where(where, params);
    const sql = "UPDATE `" + t + "` SET " + k + " WHERE " + exp;

    return (await this.database.query(
      sql,
      params,
      isLog,
      this.tableName
    )) as ResultSetHeader;
  }

  /**
   * delete
   *
   * @param where
   * @param isLog
   * @returns
   */
  async delete(where: Where<COLUMNS> | undefined = undefined, isLog = false) {
    const params: any[] = [];
    const t = this.tableName;
    let sql: string = `DELETE FROM \`${t}\``;
    const exp = where ? " WHERE " + this.where(where, params) : "";

    return (await this.database.query(
      sql + exp,
      params,
      isLog,
      this.tableName
    )) as ResultSetHeader;
  }

  /**
   * upsert
   *
   * @param table
   * @param insert
   * @param updateNames
   * @returns
   */
  async upsert(insert: TYPE, updateNames: (keyof TYPE)[], isLog = false) {
    const keys: string[] = [];
    const vals: string[] = [];
    const kvs: string[] = [];
    const params: any[] = [];
    for (const key of Object.keys(insert)) {
      keys.push("`" + key + "`");
      vals.push("?");
      params.push(this.database.convertTo(insert[key as keyof typeof insert]));
    }
    for (const key of updateNames) {
      const k = key as string;
      kvs.push("`" + k + "`=?");
      params.push(this.database.convertTo(insert[key as keyof typeof insert]));
    }
    const k = keys.join(",");
    const v = vals.join(",");
    const t = this.tableName;
    let sql = "INSERT INTO `" + t + "`(" + k + ") values(" + v + ")";
    sql += " ON DUPLICATE KEY UPDATE " + kvs.join(",");

    return (await this.database.query(
      sql,
      params,
      isLog,
      this.tableName
    )) as ResultSetHeader;
  }
}
