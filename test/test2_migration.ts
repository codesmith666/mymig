import { Migration, Config, DSN } from "../src";
import fs from "node:fs/promises";
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

/**
 * output config
 */
const config: Config = {
  imports: {
    "../src": ["MyMigDB", "Table"],
    "@nence/datetime": ["Datetime"],
    "./id.ts": [
      "UserID",
      "GroupID",
      "MemberID",
      "MarkdownID",
      "ServiceID",
      "SubscribeID",
    ],
  },
};

async function main() {
  const inputPath = thisDir + "schema.mig";
  const outputPath = thisDir + "mymig.ts";

  console.log(` input:${inputPath}`);
  const uint8array = await fs.readFile(inputPath);
  const schema = new TextDecoder("utf-8").decode(uint8array);
  const tsFile = await Migration.run(dsn, config, schema);
  if (tsFile) {
    await fs.writeFile(outputPath, tsFile);
    console.log(`output:${outputPath}`);
  }
}

await main();
process.exit(0);
