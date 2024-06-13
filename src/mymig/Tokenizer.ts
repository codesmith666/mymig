export class Tokenizer {
  // 検出器
  static readonly reName = "(?<name>\\w+)"; // テーブル名
  static readonly reColumn = "(?<column>:\\w+)"; // カラム名設定
  static readonly reTable = "(?<table>@\\w+)"; //  テーブル設定
  static readonly reCharset = "(?<charset>(?:\\w+)?/(?:\\w+)?)"; // キャラクタセット
  static readonly reQuote = "(?<quote>')"; //  文字列開始
  static readonly reEscape = "(?<escape>\\\\')"; // 文字エスケープ
  static readonly reComment = "(?<comment>--)"; // コメント
  static readonly reOpen = "(?<open>\\{)"; // テーブル定義開始
  static readonly reClose = "(?<close>\\})"; // テーブル定義終了
  static readonly reCRLF = "(?<crlf>\r\n|\r|\n)"; // 改行コードの検出
  static readonly reExclaim = "(?<exclaim>!)"; // エクスクラメーションマーク
  static readonly reQuestion = "(?<question>\\?)"; // クエッションマーク
  static readonly reWrapper = "(?<wrapper>\\$\\w+)"; // ラッパークラス

  // 利用できる型の一覧
  static readonly reTypes = {
    // 数値型 decimal/bit/real/serialには対応しない
    "tinyint|int8": "tinyint",
    "smallint|int16": "smallint",
    "mediumint|int24": "mediumint",
    "bigint|int64": "bigint",
    "int32|integer|int": "int",
    "float64|double|real": "double",
    "boolean|bool": "boolean",
    "float32|float": "float",
    // 日時型 date/time/yeay/timestampには対応しない
    "datetime|timestamp": "datetime",
    // 文字列型 char型には対応しない
    "varchar\\d+": "varchar",
    "tinytext|text255": "tinytext",
    "mediumtext|text16m": "mediumtext",
    "longtext|text4g": "longtext",
    "text64k|text": "text",
  };

  /**
   * 正規表現による検出器を作成する
   * @param tags
   * @returns
   */
  // deno-lint-ignore no-explicit-any
  static genRegExp(tags: any[]) {
    const a: string[] = [];
    for (const val of tags) {
      if (typeof val === "object") {
        for (const k of Object.keys(val)) {
          a.push(`(?<${val[k]}>${k})`);
        }
      } else {
        a.push(val);
      }
    }
    return RegExp(a.join("|"));
  }

  /**
   * 定義の一番外側の検出器
   */
  static readonly reBase: RegExp = this.genRegExp([
    this.reCRLF,
    this.reComment,
    this.reName,
    this.reOpen,
  ]);

  /**
   * ブロック内で使用する検出器
   */
  static readonly reBlock: RegExp = this.genRegExp([
    this.reCRLF,
    this.reComment, //  charsetより前
    this.reExclaim,
    this.reQuestion,
    this.reClose,
    this.reColumn,
    this.reTable,
    this.reCharset,
    this.reQuote,
    this.reTypes,
    this.reWrapper,
  ]);

  /**
   * クォート内の検出器
   */
  static readonly reQuoted: RegExp = this.genRegExp([
    this.reCRLF,
    this.reEscape,
    this.reQuote,
  ]);
}
