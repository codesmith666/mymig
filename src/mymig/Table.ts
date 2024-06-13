import { Analyzer } from "./Analyzer.js";
import { Util } from "./Util.js";
import { Column } from "./Column.js";
import { Charsets } from "./Charset.js";
import { Collates } from "./Collate.js";

type BlockMode =
  | "none"
  | "column"
  | "primary"
  | "charset"
  | "comment"
  | "unique0"
  | "unique1"
  | "unique2"
  | "unique3"
  | "unique4"
  | "unique5"
  | "unique6"
  | "unique7"
  | "unique8"
  | "unique9"
  | "index0"
  | "index1"
  | "index2"
  | "index3"
  | "index4"
  | "index5"
  | "index6"
  | "index7"
  | "index8"
  | "index9";

export class Table {
  ana: Analyzer;
  // 永久不変ID:リネームの検出に使うので変更不可
  id = "";
  mode: BlockMode = "none";
  name: string;
  comment = "";
  charset = "";
  collate = "";
  columns: Column[] = [];
  primary: string[] = [];
  indexes: { [key: string]: string[] } = {};
  uniques: { [key: string]: string[] } = {};
  constructor(ana: Analyzer) {
    this.name = ana.tableName;
    this.ana = ana;
  }
  get column() {
    if (this.mode === "column") {
      return this.columns[this.columns.length - 1];
    }
    return null;
  }

  getColumnByID(id: string) {
    return this.columns.find((c) => c.id === id);
  }

  output(message: string) {
    this.ana.output(message);
  }

  setTableID(value: string) {
    this.id = value;
  }

  setTableComment(value: string) {
    this.comment = value;
  }

  // カラムIDを保存する
  setColumnID(value: string) {
    switch (this.mode) {
      case "column":
        this.column!.id = value;
        break;
      default:
        this.output(`could not specify '${value}' on mode:'${this.mode}'`);
        break;
    }
  }

  // モードに応じてカラム名を取得する
  setColumnName(name: string) {
    switch (this.mode) {
      case "column":
        this.column!.name = name;
        break;
      case "primary":
        this.primary.push(name);
        break;
      case "unique0":
      case "unique1":
      case "unique2":
      case "unique3":
      case "unique4":
      case "unique5":
      case "unique6":
      case "unique7":
      case "unique8":
      case "unique9":
        this.uniques[this.name + "_" + this.mode].push(name);
        break;
      case "index0":
      case "index1":
      case "index2":
      case "index3":
      case "index4":
      case "index5":
      case "index6":
      case "index7":
      case "index8":
      case "index9":
        this.indexes[this.name + "_" + this.mode].push(name);
        break;
    }
  }

  // カラムのラッパークラスを指定する
  setWrapperClass(name: string) {
    this.column!.wrapper = name;
  }

  // 現在のブロックの解析モード
  setMode(mode: BlockMode) {
    switch (mode) {
      case "column": {
        const column = new Column(this);
        this.columns.push(column);
        break;
      }
      case "index0":
      case "index1":
      case "index2":
      case "index3":
      case "index4":
      case "index5":
      case "index6":
      case "index7":
      case "index8":
      case "index9":
        this.indexes[this.name + "_" + mode] = [];
        break;
      case "unique0":
      case "unique1":
      case "unique2":
      case "unique3":
      case "unique4":
      case "unique5":
      case "unique6":
      case "unique7":
      case "unique8":
      case "unique9":
        this.uniques[this.name + "_" + mode] = [];
        break;
    }
    this.mode = mode;
  }
  resetMode() {
    this.mode = "none";
  }

  /** キャラクタセットと照合順序 */
  setCharset(value: string) {
    const sets = value.split("/");
    const charset = sets[0];
    const collate = sets[1];

    if (!Charsets.includes(charset)) {
      this.output(`unsupported charset - "${charset}"`);
    }
    if (!Collates.includes(collate)) {
      this.output(`unsupported collate - "${collate}"`);
    }

    switch (this.mode) {
      case "column":
        this.column!.charset = charset;
        this.column!.collate = collate;
        break;
      case "charset":
        this.charset = charset;
        this.collate = collate;
        break;
      default:
        this.output(`could not specify '${value}' on mode:'${this.mode}'`);
        break;
    }
  }

  /** カラムに not null を設定する */
  setNullable(value: boolean) {
    switch (this.mode) {
      case "column":
        this.column!.nullable = value;
        break;
      default:
        this.output(`could not specify '${value}' on mode:'${this.mode}'`);
        break;
    }
  }

  /** カラムの型を設定する */
  setColumnType(type: string, size: string) {
    switch (this.mode) {
      case "column":
        this.column!.type = type;
        this.column!.size = size;
        break;
      default: {
        const value = type + size;
        this.output(`could not specify '${value}' on mode:'${this.mode}'`);
        break;
      }
    }
  }

  /** カラムのコメントを設定する */
  setColumnComment(value: string) {
    switch (this.mode) {
      case "column":
        this.column!.comment = value;
        break;
      default:
        this.output(`could not specify '${value}' on mode:'${this.mode}'`);
        break;
    }
  }
  /** カラムのデフォルト値を設定する */
  setColumnDefault(value: string) {
    switch (this.mode) {
      case "column":
        this.column!.default = value;
        break;
      default:
        this.output(`could not specify '${value}' on mode:'${this.mode}'`);
        break;
    }
  }

  get sql() {
    // カラム情報取得
    const cols: string[] = [];
    for (const column of this.columns) {
      cols.push("  " + column.sql);
    }
    // Primary Key
    const pk: string[] = [];
    for (const p of this.primary) {
      pk.push(`\`${p}\``);
    }
    cols.push("  PRIMARY KEY(" + pk.join(",") + ")");
    // Unique 制約
    for (const k of Object.keys(this.uniques)) {
      const name = `\`${k}\``;
      const columns: string[] = [];
      for (const columnName of this.uniques[k]) {
        columns.push(`\`${columnName}\``);
      }
      cols.push(`  UNIQUE ${name}(${columns.join(",")})`);
    }
    // Index
    for (const k of Object.keys(this.indexes)) {
      const name = `\`${k}\``;
      const columns: string[] = [];
      for (const columnName of this.indexes[k]) {
        columns.push(`\`${columnName}\``);
      }
      cols.push(`  INDEX ${name}(${columns.join(",")})`);
    }
    // comment
    const comment = this.id + " " + this.comment.replace("'", "''");

    let sql = "";
    sql += `CREATE TABLE IF NOT EXISTS \`${this.name}\`(\n`;
    sql += cols.join(",\n") + "\n";
    sql += ")";
    sql += "ENGINE=InnoDB ";
    sql += `DEFAULT CHARSET=${this.charset} COLLATE=${this.collate} `;
    sql += "COMMENT '" + comment + "';\n";
    sql += "\n";

    return sql;
  }

  /**
   * TypeScriptのコードを生成
   */
  ts() {
    const name = Util.ucfirst(this.name);
    // カラム定義の収集
    const strings: string[] = [];
    const strings2: string[] = [];
    const getter: string[] = [];
    const setter: string[] = [];

    for (const column of this.columns) {
      const c = column.ts(true);
      if (!c) continue;
      const d = column.ts(false);
      if (!d) continue;
      strings.push("  " + c);
      strings2.push("  " + d);
      getter.push(`      ${column.name}: this.${column.name},`);
      setter.push(`      this.${column.name} = param.${column.name};`);
    }

    // テーブル型の作成
    let string = "";
    string += `/**\n`;
    string += ` *  ${name}\n`;
    string += ` */\n`;
    string += `export type ${name}Type = {\n`;
    string += strings.join("\n") + "\n";
    string += "};\n\n";
    // テーブルクラスの作成
    string += `export class ${name}Table extends Table<${name}Type,keyof ${name}Type> implements Required<${name}Type> {\n`;
    string += strings2.join("\n") + "\n";
    string += `  constructor(database: MyMigDB){\n`;
    string += `    super("${this.name}",database);\n`;
    string += `  }\n`;
    string += `  get():Required<${name}Type>{\n`;
    string += `    return {\n`;
    string += getter.join("\n") + "\n";
    string += `    };\n`;
    string += `  }\n`;
    string += `  set(param: Required<${name}Type>){\n`;
    string += setter.join("\n") + "\n";
    string += `  }\n`;
    string += `}\n\n`;

    return string;
  }
}
