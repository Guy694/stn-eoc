#!/usr/bin/env node
/**
 * ค้นหาและรีเซ็ตบัญชีเจ้าหน้าที่ที่ยังใช้รหัสผ่านเดาง่าย (เช่น 1234 จากสคริปต์นำเข้ารุ่นเก่า)
 *
 * การใช้งาน:
 *   node --env-file=.env scripts/revoke-weak-passwords.js --dry-run
 *   node --env-file=.env scripts/revoke-weak-passwords.js --credentials-out ~/secure/eoc-temp-passwords.json
 *
 * สิ่งที่สคริปต์ทำกับบัญชีที่พบ:
 *   1. ตั้งรหัสผ่านชั่วคราวแบบสุ่มใหม่ (ยาว 14 ตัว)
 *   2. ตั้ง must_change_password = 1 (ผู้ใช้ต้องเปลี่ยนรหัสผ่านก่อนใช้งานระบบ)
 *   3. ปิด session ที่เปิดค้างอยู่ทั้งหมดของบัญชีนั้น
 *   4. เขียนรหัสชั่วคราวลงไฟล์ (สิทธิ์ 600) นอกโฟลเดอร์โปรเจกต์ เพื่อแจกจ่ายทางช่องทางที่ปลอดภัย
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const WEAK_PASSWORDS = ['1234', '12345', '123456', '12345678', '123456789', 'password', 'admin', 'admin1234', 'satun1234'];
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generateTemporaryPassword(length = 14) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const credentialsOut = argValue('--credentials-out');
  const projectRoot = path.resolve(__dirname, '..');

  if (!dryRun && !credentialsOut) {
    throw new Error('ต้องระบุ --credentials-out <path นอก repository> หรือใช้ --dry-run');
  }
  if (credentialsOut && path.resolve(credentialsOut).startsWith(projectRoot + path.sep)) {
    throw new Error('--credentials-out ต้องอยู่นอกโฟลเดอร์โปรเจกต์ เพื่อไม่ให้รหัสผ่านหลุดเข้า git');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'stneoc',
    port: Number(process.env.DB_PORT || 3306),
    charset: 'utf8mb4',
  });

  const affected = [];
  try {
    const [officers] = await connection.execute(
      'SELECT id, username, given_name, family_name, password_hash FROM officer WHERE password_hash IS NOT NULL'
    );

    for (const officer of officers) {
      let weakMatch = null;
      for (const candidate of [...WEAK_PASSWORDS, officer.username]) {
        if (candidate && await bcrypt.compare(candidate, officer.password_hash)) {
          weakMatch = candidate === officer.username ? '<same-as-username>' : candidate;
          break;
        }
      }
      if (!weakMatch) continue;

      const entry = {
        id: officer.id,
        username: officer.username,
        name: `${officer.given_name || ''} ${officer.family_name || ''}`.trim(),
        weakPasswordMatched: weakMatch,
      };

      if (!dryRun) {
        const temporaryPassword = generateTemporaryPassword();
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);
        await connection.execute(
          `UPDATE officer
           SET password_hash = ?, must_change_password = 1, failed_login_attempts = 0,
               account_locked_until = NULL, updated_at = NOW()
           WHERE id = ?`,
          [passwordHash, officer.id]
        );
        await connection.execute('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?', [officer.id]);
        entry.temporaryPassword = temporaryPassword;
      }

      affected.push(entry);
    }
  } finally {
    await connection.end();
  }

  if (!dryRun && affected.length > 0) {
    fs.writeFileSync(credentialsOut, JSON.stringify(affected, null, 2), { encoding: 'utf8', mode: 0o600 });
  }

  console.log(JSON.stringify({
    dryRun,
    weakAccounts: affected.length,
    accounts: affected.map(({ temporaryPassword, ...rest }) => rest),
    credentialsOut: dryRun ? null : credentialsOut,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
