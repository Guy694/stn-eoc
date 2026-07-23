import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import mysql from "mysql2/promise";

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function encrypt(buffer, secret) {
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([Buffer.from("STNEOC1"), iv, cipher.getAuthTag(), encrypted]);
}

async function listFiles(directory) {
  const files = [];
  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true }).catch(() => [])) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  await walk(directory);
  return files;
}

const output = path.resolve(arg("--output", path.join(process.cwd(), "backups", `eoc-${new Date().toISOString().replaceAll(":", "-")}.backup`)));
const includeFiles = process.argv.includes("--include-files");
const secret = process.env.BACKUP_ENCRYPTION_KEY;
if (!secret || secret.length < 16) throw new Error("BACKUP_ENCRYPTION_KEY ต้องมีอย่างน้อย 16 ตัวอักษร");

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "stneoc",
});

const payload = {
  format: "stn-eoc-backup-v1",
  database: process.env.DB_NAME || "stneoc",
  created_at: new Date().toISOString(),
  tables: [],
  files: [],
};

try {
  const [tables] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  for (const tableRow of tables) {
    const table = Object.values(tableRow)[0];
    const [createRows] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
    const [columnRows] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
    const insertable = columnRows.filter((column) => !String(column.Extra || "").includes("GENERATED"));
    const columns = insertable.map((column) => column.Field);
    const columnTypes = Object.fromEntries(insertable.map((column) => [column.Field, String(column.Type).toLowerCase()]));
    const selectFields = insertable.map((column) => {
      const type = String(column.Type).toLowerCase();
      if (/geometry|point|polygon/.test(type)) return `ST_AsText(\`${column.Field}\`) AS \`${column.Field}\``;
      if (type === "json") return `CAST(\`${column.Field}\` AS CHAR) AS \`${column.Field}\``;
      return `\`${column.Field}\``;
    });
    const [rows] = await connection.query(`SELECT ${selectFields.join(",")} FROM \`${table}\``);
    payload.tables.push({ name: table, create_sql: createRows[0]["Create Table"], columns, column_types: columnTypes, rows });
  }
} finally {
  await connection.end();
}

if (includeFiles) {
  const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
  for (const file of await listFiles(uploadsRoot)) {
    const buffer = await fs.readFile(file);
    payload.files.push({
      relative_path: path.relative(uploadsRoot, file),
      checksum_sha256: sha256(buffer),
      content_base64: buffer.toString("base64"),
    });
  }
}

const plain = Buffer.from(JSON.stringify(payload));
const encrypted = encrypt(plain, secret);
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, encrypted, { mode: 0o600 });
await fs.writeFile(`${output}.sha256`, `${sha256(encrypted)}  ${path.basename(output)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ success: true, output, checksum_sha256: sha256(encrypted), tables: payload.tables.length, files: payload.files.length }));
