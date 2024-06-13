import { MyMigDB, DSN } from "../MyMigDB.js";
import { Analyzer, Config } from "./Analyzer.js";
import { DBSchema } from "./DBSchema.js";
import { Util } from "./Util.js";

export class Migration {
  static async run(dsn: DSN, config: Config, schema: string) {
    const db = new MyMigDB(dsn);
    try {
      // DBコネクションを取得
      const con = await db.get();
      // 宣言されたスキーマを取得
      const declare = new Analyzer(schema);
      // 現在のテーブル定義を取得
      const actual = await DBSchema.initialize(db);

      // まず[宣言]から消えたテーブルがあれば[定義]から消す
      // for (const act of actual.tables) {
      //   const dec = declare.getByID(act.id);
      //   if (!dec) {
      //     const sql = `DROP TABLE IF EXISTS \`${act.name}\`;`;
      //     console.log(sql);
      //     await con.execute(sql);
      //   }
      // }

      // 次に[宣言]と[定義]が一致しているか調べる
      for (const dec of declare.tables) {
        const act = actual.getByID(dec.id);
        // 指定したIDのテーブルは存在しないので作る
        if (!act) {
          const sql = dec.sql;
          console.log(sql);
          await con.execute(sql);
          continue;
        }
        // コメントが変わっていたら更新
        if (act.comment !== dec.comment) {
          const comment = Util.buildComment(dec.id, dec.comment);
          const sql = `ALTER TABLE \`${act.name}\` COMMENT ${comment};`;
          console.log(sql);
          await con.execute(sql);
        }

        // カラム定義が変わっていたら更新
        for (const actcol of act.columns) {
          const deccol = dec.getColumnByID(actcol.id);
          if (!deccol) {
            const sql = `ALTER TABLE \`${act.name}\` DROP COLUMN \`${actcol.name}\`;`;
            console.log(sql);
            await con.execute(sql);
          } else {
            // 型を変更
            if (
              actcol.type !== deccol.compatibleType ||
              actcol.nullable !== deccol.nullable ||
              actcol.comment !== deccol.comment ||
              actcol.default !== deccol.compatibleDefault ||
              (actcol.collation &&
                actcol.collation !== deccol.compatibleCollation)
            ) {
              const sql = `ALTER TABLE \`${act.name}\` MODIFY COLUMN ${deccol.sql}`;
              console.log(sql);
              await con.execute(sql);
            }
            // カラム名を変更は最後に
            if (actcol.name !== deccol.name) {
              const sql = `ALTER TABLE \`${act.name}\` CHANGE \`${actcol.name}\` ${deccol.sql}`;
              console.log(sql);
              await con.execute(sql);
            }
          }
        }
        for (const deccol of dec.columns) {
          const actcol = act.getColumnByID(deccol.id);
          if (!actcol) {
            const sql = `ALTER TABLE \`${act.name}\` ADD ${deccol.sql}`;
            console.log(sql);
            await con.execute(sql);
          }
        }
      }

      // インデックスの処理をする前に定義をリロード
      await actual.reload();
      for (const dec of declare.tables) {
        const act = actual.getByID(dec.id);
        if (!act) continue;

        // PKが変わっていたら更新
        if (JSON.stringify(act.primary) !== JSON.stringify(dec.primary)) {
          if (act.primary.length > 0) {
            const sql1 = `DROP INDEX \`PRIMARY\` ON \`${act.name}\`;`;
            console.log(sql1);
            await con.execute(sql1);
          }
          if (dec.primary.length > 0) {
            const cols = dec.primary.map((col) => `\`${col}\``);
            const sql2 = `ALTER TABLE \`${act.name}\` ADD PRIMARY KEY (${cols});`;
            console.log(sql2);
            await con.execute(sql2);
          }
        }
        // UniqueIndexが変わっていたら更新
        for (const name of Object.keys(act.uniques)) {
          const actJSON = JSON.stringify(act.uniques[name]);
          const decJSON = JSON.stringify(dec.uniques[name]);
          if (!dec.uniques[name] || actJSON !== decJSON) {
            const sql = `DROP INDEX \`${name}\` ON \`${act.name}\`;`;
            console.log(sql);
            await con.execute(sql);
          }
        }
        for (const name of Object.keys(dec.uniques)) {
          const actJSON = JSON.stringify(act.uniques[name]);
          const decJSON = JSON.stringify(dec.uniques[name]);
          if (!act.uniques[name] || actJSON !== decJSON) {
            const cols = dec.uniques[name].map((col) => `\`${col}\``);
            const sql = `CREATE UNIQUE INDEX \`${name}\` ON \`${act.name}\` (${cols});`;
            console.log(sql);
            await con.execute(sql);
          }
        }
        // Indexが変わっていたら更新
        for (const name of Object.keys(act.indexes)) {
          const actJSON = JSON.stringify(act.indexes[name]);
          const decJSON = JSON.stringify(dec.indexes[name]);
          if (!dec.indexes[name] || actJSON !== decJSON) {
            const sql = `DROP INDEX \`${name}\` ON \`${act.name}\`;`;
            console.log(sql);
            await con.execute(sql);
          }
        }
        for (const name of Object.keys(dec.indexes)) {
          const actJSON = JSON.stringify(act.indexes[name]);
          const decJSON = JSON.stringify(dec.indexes[name]);
          if (!act.indexes[name] || actJSON !== decJSON) {
            const cols = dec.indexes[name].map((col) => `\`${col}\``);
            const sql = `CREATE INDEX \`${name}\` ON \`${act.name}\` (${cols});`;
            console.log(sql);
            await con.execute(sql);
          }
        }
        // collationが変わっていたら更新
        if (act.collation && act.collation !== dec.collate) {
          const sql = `ALTER TABLE \`${act.name}\` COLLATE '${dec.collate}';`;
          console.log(sql);
          await con.execute(sql);
        }

        // 最後にテーブル名が変わっていたら更新
        if (act.name !== dec.name) {
          const sql = `RENAME TABLE \`${act.name}\` TO \`${dec.name}\`;`;
          console.log(sql);
          await con.execute(sql);
        }
      }

      // 型ファイル生成
      return declare.base.createTsFile(config);
    } catch (e) {
      console.log(e);
      return undefined;
    } finally {
      db.release();
    }
  }
}
