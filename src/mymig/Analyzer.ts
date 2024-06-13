import { Tokenizer } from "./Tokenizer.js";
import { Base } from "./Base.js";
import { Table } from "./Table.js";
import { Quoted } from "./Quoted.js";
import { Util } from "./Util.js";
/**
 * 解析クラス
 */
export type Config = {
  imports: { [key: string]: string[] };
};

export class Analyzer {
  // カレントブロック名
  tableName = "";
  // テキストの処理行数
  line = 1;
  base: Base = undefined!;
  output(message: string) {
    console.log(message + " on line " + this.line + ".");
  }
  constructor(source: string) {
    this.run(source);
  }

  get tables() {
    return this.base.tables;
  }
  getByID(id: string) {
    return this.tables.find((table) => table.id === id);
  }

  // カラム定義をパースする
  private run(source: string) {
    /**
     * parse関数
     */
    const parse = (parent: Base | Table | Quoted) => {
      let detector;
      if (parent instanceof Base) {
        detector = Tokenizer.reBase;
      } else if (parent instanceof Table) {
        detector = Tokenizer.reBlock;
      } else {
        detector = Tokenizer.reQuoted;
      }

      while (source) {
        // tokenを探す（見つけられなかったら終了）
        const m = source.match(detector);
        if (!m) {
          if (source.trim() !== "") {
            this.output(`unknown token "${source}"`);
          }
          source = "";
          continue;
        }

        // 発見したら token とその type と notToken(トークンでない部分)を得る
        const groups = m.groups!;
        const index = m.index || 0;
        const notToken = source.slice(0, index);
        let type = "";
        let token = "";
        for (const k of Object.keys(groups)) {
          const v = groups![k];
          if (v === undefined) continue;
          type = k;
          token = v;
          break;
        }

        // マッチしたtokenの後ろまで進めておく（次の処理のために）
        source = source.slice(index + token.length);

        //
        // ベースの解析処理（ブロックの検出）
        //
        if (parent instanceof Base) {
          // token以外認めない
          if (notToken.trim() !== "") {
            this.output(`unknown keyword "${notToken}"`);
            break;
          }
          switch (type) {
            // 改行を検出した
            case "crlf":
              this.line++;
              break;
            // ブロック名を検出した（すでにある場合はエラー）
            case "name":
              if (this.tableName) {
                this.output(`block name already defined "${token}"`);
                continue;
              }
              this.tableName = token;
              break;
            // ベースに定義されているコメントは現在読み飛ばしている
            case "comment": {
              this.line++;
              const m = source.match(/\r\n|\r|\n/);
              if (!m) source = "";
              else source = source.slice(m.index || 0);
              break;
            }
            // ブロックの開始を検出した
            case "open":
              if (!this.tableName) {
                this.output(`block name not specified`);
                source = "";
                continue;
              }
              parse(parent.newTable());
              break;
          }
        } //
        // ブロックの解析処理（おもにカラムの検出）
        //
        else if (parent instanceof Table) {
          if (notToken.trim() !== "") {
            console.log(`unknown keyword "${notToken}" on line ${this.line}.`);
            break;
          }
          switch (type) {
            // \n
            case "crlf":
              this.line++;
              parent.resetMode();
              break;
            // '
            case "quote": {
              const quoted = new Quoted();
              parse(quoted);
              parent.setColumnDefault(quoted.value);
              break;
            }
            // :
            case "column": {
              if (parent.mode === "none") {
                parent.setMode(type);
              }
              parent.setColumnName(token.slice(1));
              break;
            }
            // $ ラッパークラス
            case "wrapper":
              parent.setWrapperClass(token.slice(1));
              break;
            // @
            case "table": {
              const mode = token.slice(1);
              switch (mode) {
                // コメントを見つけたら行末まで取り込む
                case "comment": {
                  const m = source.match(/\r\n|\r|\n/);
                  if (m) {
                    // 改行手前まで取得して改行まで進める
                    const index = m.index || 0;
                    const raw = source.slice(0, index);
                    source = source.slice(index);
                    // コメントを取得する
                    const { id, comment } = Util.parseComment(raw);
                    parent.setTableID(id);
                    parent.setTableComment(comment);
                  } else {
                    parent.comment = source.trim();
                    source = "";
                  }
                  break;
                }
                case "charset":
                case "primary":
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
                  parent.setMode(mode);
                  break;
                default:
                  this.output(`unknown mode - '${mode}'`);
                  break;
              }
              break;
            }
            // !
            case "exclaim": {
              parent.setNullable(false);
              break;
            }
            // ?
            case "question": {
              parent.setNullable(true);
              break;
            }
            // カラム型
            case "tinyint":
            case "smallint":
            case "mediumint":
            case "int":
            case "bigint":
            case "double":
            case "float":
            case "boolean":
            case "datetime":
            case "varchar":
            case "tinytext":
            case "text":
            case "mediumtext":
            case "longtext": {
              let size = "";
              if (type === "varchar") {
                size = "(" + token.slice(7) + ")";
              }
              parent.setColumnType(type, size);
              break;
            }
            // "{charset}/{collate}"
            case "charset": {
              parent.setCharset(token);
              break;
            }
            // -- コメント
            case "comment": {
              const m = source.match(/\r\n|\r|\n/);
              if (m) {
                const index = m.index || 0;
                const raw = source.slice(0, index);
                source = source.slice(index);

                const { id, comment } = Util.parseComment(raw);
                parent.setColumnID(id);
                parent.setColumnComment(comment);
              }
              break;
            }
            case "close":
              this.tableName = "";
              return; // Blockを終了して親に戻る
          }
        } //
        // Quoteの解析処理（デフォルト値の検出）
        //
        else if (parent instanceof Quoted) {
          switch (type) {
            case "crlf":
              this.line++;
              parent.addString(notToken, this.line);
              break;
            case "escape":
              parent.addString(notToken + "'", this.line);
              break;
            case "quote":
              parent.addString(notToken, this.line);
              return; //  モード終了
          }
        } // switch
      } // while
      return;
    };
    const base = new Base(this);
    parse(base);
    this.base = base;
    return this;
  }
}
