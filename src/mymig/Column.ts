import { Analyzer } from "./Analyzer.js";
import { Table } from "./Table.js";
export class Column {
  ana: Analyzer;
  table: Table;
  line = 0;
  id: string = undefined!;
  name: string = undefined!;
  type: string = undefined!;
  size: string = undefined!;
  charset: string = undefined!;
  collate: string = undefined!;
  nullable = false;
  default: string = undefined!;
  comment: string = undefined!;
  wrapper: string = undefined!;

  constructor(table: Table) {
    this.ana = table.ana;
    this.table = table;
    this.line = this.ana.line;
  }

  output(msg: string) {
    console.log(`${msg} on line ${this.line}`);
  }

  /**
   * データはそろっていて出力できる状態にあるか？
   */
  get isValid() {
    if (!this.type) {
      console.log(`type not found on line ${this.line}`);
      return false;
    }
    return true;
  }

  get compatibleType() {
    switch (this.type) {
      case "tinyint":
      case "smallint":
      case "mediumint":
      case "int":
      case "bigint":
      case "double":
      case "float":
      case "datetime":
      case "tinytext":
      case "text":
      case "mediumtext":
      case "longtext":
        return this.type;
      case "boolean":
        return "tinyint(1)";
      case "varchar":
        return this.type + this.size;
    }
    return undefined;
  }

  get compatibleDefault() {
    if (this.default === undefined) return null;
    if (this.type === "boolean") {
      if (this.default === "false") return "0";
      if (this.default === "true") return "1";
    }
    return this.default;
  }

  get compatibleCollation() {
    if (!this.collate) return this.table.collate;
    return this.collate;
  }

  /**
   * SQL出力
   */
  get sql() {
    if (!this.isValid) {
      this.output("column info not ready");
      return "";
    }

    let string;
    string = "`" + this.name + "`";
    string += " " + this.type + this.size;
    if (this.charset) string += " CHARACTER SET " + this.charset;
    if (this.collate) string += " COLLATE " + this.collate;
    string += this.nullable ? " NULL" : " NOT NULL";
    // デフォルト処理
    if (this.default !== undefined) {
      switch (this.type) {
        case "varchar":
        case "text":
        case "tinytext":
        case "mediumtext":
        case "longtext": {
          const escaped = this.default.replace("'", "''");
          string += " DEFAULT '" + escaped + "'";
          break;
        }
        case "boolean":
        case "datetime":
        case "smallint":
        case "int":
        case "mediumint":
        case "tinyint":
        case "bigint":
        case "float":
        case "double":
          string += " DEFAULT " + this.default;
          break;
      }
    }
    // コメント処理
    const escaped = this.id + " " + this.comment.replace("'", "''");
    string += " COMMENT '" + escaped + "'";
    return string;
  }

  /**
   * ts出力
   */
  ts(omittable: boolean) {
    if (!this.isValid) return undefined;
    let string;
    string = omittable ? `${this.name}?: ` : `${this.name}: `;
    switch (this.type) {
      case "boolean":
        string += this.wrapper ?? "boolean";
        break;
      case "varchar":
      case "text":
      case "tinytext":
      case "mediumtext":
      case "longtext":
        string += this.wrapper ?? "string";
        break;
      case "datetime":
        //string += "Date";
        string += this.wrapper ?? "datetime";
        break;
      case "smallint":
      case "int":
      case "mediumint":
      case "tinyint":
      case "bigint":
      case "float":
      case "double":
        string += this.wrapper ?? "number";
        break;
    }
    if (this.nullable) {
      string += " | null";
    }
    string += omittable ? "" : " = undefined!";
    string += ";";
    if (this.comment) {
      string += " // " + this.comment;
    }
    return string;
  }
}
