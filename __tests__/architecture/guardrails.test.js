/**
 * @jest-environment node
 *
 * กฎสถาปัตยกรรมที่ตรวจด้วยการอ่านซอร์สโค้ด เพื่อกันปัญหาเดิมกลับมาอีก
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function listFiles(dir, predicate, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) listFiles(full, predicate, out);
        else if (predicate(full)) out.push(full);
    }
    return out;
}

const isSource = (file) => /\.(js|jsx|mjs)$/.test(file);
const appAndLib = [
    ...listFiles(path.join(ROOT, 'app'), isSource),
    ...listFiles(path.join(ROOT, 'lib'), isSource),
];
const rel = (file) => path.relative(ROOT, file);
const read = (file) => fs.readFileSync(file, 'utf8');

describe('architecture guardrails', () => {
    test('only lib/db.js creates a MySQL connection pool', () => {
        const offenders = appAndLib
            .filter((file) => rel(file) !== path.join('lib', 'db.js'))
            .filter((file) => /\bcreatePool\s*\(/.test(read(file)))
            .map(rel);
        expect(offenders).toEqual([]);
    });

    test('request handlers never change the database schema at runtime', () => {
        const offenders = listFiles(path.join(ROOT, 'app'), isSource)
            .filter((file) => /\b(CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i.test(read(file)))
            .map(rel);
        expect(offenders).toEqual([]);
    });

    test('role permission tables are defined only in lib/auth.js', () => {
        const offenders = appAndLib
            .filter((file) => rel(file) !== path.join('lib', 'auth.js'))
            .filter((file) => /const\s+rolePermissions\s*=/.test(read(file)))
            .map(rel);
        expect(offenders).toEqual([]);
    });

    test('X-Forwarded-For is parsed only by lib/clientIp.js', () => {
        const offenders = appAndLib
            .filter((file) => rel(file) !== path.join('lib', 'clientIp.js'))
            .filter((file) => /x-forwarded-for/i.test(read(file)))
            .map(rel);
        expect(offenders).toEqual([]);
    });

    test.each([
        'app/api/commander/dashboard/route.js',
        'app/api/eoc/flood/vulnerable-groups/stats/route.js',
        'app/api/eoc/accident/area-status/route.js',
        'app/api/eoc/flood/daily-flood/route.js',
        'app/api/eoc/flood/daily-flood-village/route.js',
        'app/api/eoc/gistda/flood/route.js',
        'app/api/eoc/gistda/flood-freq/route.js',
    ])('%s requires an authenticated officer', (file) => {
        expect(read(path.join(ROOT, file))).toMatch(/requireAuth\(request, OFFICER_ROLES\)/);
    });

    test('scripts contain no hard-coded default passwords', () => {
        const offenders = listFiles(path.join(ROOT, 'scripts'), isSource)
            .filter((file) => /(DEFAULT_PASSWORD\s*=\s*['"]|DB_PASSWORD \|\| ['"][^'"]+['"])/.test(read(file)))
            .map(rel);
        expect(offenders).toEqual([]);
    });

    test('every migration file is listed in migrations/manifest.json', () => {
        const manifest = JSON.parse(read(path.join(ROOT, 'migrations', 'manifest.json')));
        const onDisk = fs.readdirSync(path.join(ROOT, 'migrations')).filter((name) => name.endsWith('.sql')).sort();
        expect([...manifest.migrations].sort()).toEqual(onDisk);
    });
});
