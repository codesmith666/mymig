import { MyMigDB } from "../MyMigDB.js";
import { Util } from "./Util.js";
// カラム
type Column = {
  id: string;
  name: string;
  type: string;
  collation: string;
  nullable: boolean;
  default: string;
  comment: string;
};
// テーブル
class Table {
  id = "";
  name = "";
  collation = "";
  comment = "";
  primary: string[] = [];
  uniques: { [key: string]: string[] } = {};
  indexes: { [key: string]: string[] } = {};
  columns: Column[] = [];

  getColumnByID(id: string) {
    return this.columns.find((columns) => columns.id === id);
  }
}
export class DBSchema {
  db: MyMigDB;
  tables: Table[] = undefined!;

  constructor(db: MyMigDB) {
    this.db = db;
  }

  static async initialize(db: MyMigDB) {
    return await new DBSchema(db).reload();
  }

  async reload() {
    this.tables = [];
    const sql = "SHOW TABLE STATUS;";
    const existedTables = (await this.db.query(sql)) as {
      [key: string]: any;
    }[];
    for (const table of existedTables) {
      // テーブルの基本情報を取得する
      const { id, comment } = Util.parseComment(table.Comment);
      const tableInfo = new Table();
      tableInfo.id = id;
      tableInfo.name = table.Name;
      tableInfo.collation = table.Collation;
      tableInfo.comment = comment;
      tableInfo.primary = [];
      tableInfo.uniques = {};
      tableInfo.indexes = {};
      tableInfo.columns = [];

      // テーブルのインデックスを取得する
      const sql = `SHOW INDEX FROM \`${table.Name}\`;`;
      const indexes = (await this.db.query(sql)) as { [key: string]: any }[];
      type Index = { [key: string]: { [key: number]: string } };
      const temp = {} as Index;
      for (const index of indexes) {
        const store = temp[index.Key_name] || {};
        store[index.Seq_in_index] = index.Column_name;
        temp[index.Key_name] = store;
      }
      for (const indexName of Object.keys(temp)) {
        const keys = Object.keys(temp[indexName]);
        const idx: string[] = [];
        for (const k of keys.sort((a, b) => parseInt(a) - parseInt(b))) {
          idx.push(temp[indexName][parseInt(k)]);
        }
        if (indexName === "PRIMARY") {
          tableInfo.primary = idx;
        } else if (indexName.indexOf("unique") >= 0) {
          tableInfo.uniques[indexName] = idx;
        } else if (indexName.indexOf("index") >= 0) {
          tableInfo.indexes[indexName] = idx;
        }
      }
      // カラム情報を取得
      {
        const sql = `SHOW FULL COLUMNS FROM \`${table.Name}\`;`;
        const columns = await this.db.query(sql);
        if (Array.isArray(columns)) {
          for (const column of columns) {
            const { id, comment } = Util.parseComment(column.Comment);
            tableInfo.columns.push({
              id,
              name: column.Field,
              type: column.Type,
              collation: column.Collation,
              nullable: column.Null === "YES",
              default: column.Default,
              comment,
            });
          }
        }
      }

      this.tables.push(tableInfo);
    }
    return this;
  }
  getByID(id: string) {
    return this.tables.find((table) => table.id === id);
  }
}
