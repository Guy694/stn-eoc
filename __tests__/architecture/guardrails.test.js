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
        'app/api/eoc/vulnerable-persons/route.js',
        'app/api/eoc/vulnerable-persons/status/route.js',
    ])('%s requires an authenticated officer', (file) => {
        expect(read(path.join(ROOT, file))).toMatch(/requireAuth\(request, OFFICER_ROLES\)/);
    });

    test('vulnerable person data is never read from public routes or client bundles', () => {
        const publicOffenders = listFiles(path.join(ROOT, 'app/api/public'), isSource)
            .filter((file) => /vulnerable_persons|vulnerablePersonsCrypto|fieldCrypto/.test(read(file)))
            .map(rel);
        expect(publicOffenders).toEqual([]);
        const clientOffenders = [...listFiles(path.join(ROOT, 'components'), isSource), ...listFiles(path.join(ROOT, 'app'), isSource)]
            .filter((file) => /^["']use client["']/.test(read(file)) && /fieldCrypto|vulnerablePersonsCrypto/.test(read(file)))
            .map(rel);
        expect(clientOffenders).toEqual([]);
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

    // API ที่ตั้งใจเปิดโดยไม่ต้องเข้าสู่ระบบ — เพิ่ม route ใหม่ที่ไม่ตรวจสิทธิ์ต้องเพิ่มชื่อที่นี่พร้อมเหตุผล ไม่งั้น test ล้ม
    // (กันลืมใส่ requireAuth ใน API ที่ส่งข้อมูลภายใน/ข้อมูลส่วนบุคคล)
    const PUBLIC_API_ROUTES = {
        'เข้าสู่ระบบ/ลงทะเบียน (ตรวจตัวตนเอง)': ['auth/citizen-thaiid/authorize', 'auth/citizen-thaiid/callback', 'auth/login', 'auth/logout', 'auth/provider-id/callback', 'auth/register', 'auth/thaiid/authorize', 'auth/thaiid/callback', 'auth/thaiid/register'],
        'ข้อมูลภูมิศาสตร์/หน่วยบริการ (ไม่มีข้อมูลบุคคล)': ['common/area-polygons', 'common/areas', 'common/boundary-polygons', 'common/district-boundaries', 'common/health-facilities', 'common/tambon-boundaries', 'common/village-polygons', 'common/villages', 'common/waterways'],
        'ตัวเลขสรุปสำหรับแผนที่/หน้าสาธารณะ': ['eoc/disease/daily-stats', 'eoc/disease/outbreak-dashboard', 'eoc/disease/sessions-summary', 'eoc/festival-accidents/compare', 'eoc/festival-accidents/daily-summary', 'eoc/flood/area-status'],
        'ส่งต่อไปยัง route ที่ตรวจสิทธิ์แล้ว (re-export)': ['eoc/vulnerable-groups', 'eoc/vulnerable-groups/stats'],
        'ตรวจสถานะเซิร์ฟเวอร์': ['health'],
        'บริการประชาชน (มี rate limit)': ['assistant/route-advice', 'public/accident-reports', 'public/accident-stats', 'public/agency-contacts', 'public/announcements', 'public/announcements/popup', 'public/disease-stats', 'public/flood-disease-summary', 'public/flood-freq', 'public/flood-outlook', 'public/flood-stats', 'public/help-availability', 'public/incident-normal', 'public/infographics', 'public/offline-pack', 'public/ops-today', 'public/place-search', 'public/pm25', 'public/push', 'public/rain-stations', 'public/report-incident', 'public/sea-level', 'public/shelter-centers', 'public/site-views', 'public/situation', 'public/track', 'public/usage', 'public/villages', 'public/water-levels', 'public/weather-watch', 'public/where']
    };
    const AUTH_MARKERS = /requireAuth|getAuthSession|getCitizenSession|x-cron-secret|CRON_SECRET/;

    test('every API route checks the caller, or is a listed public route', () => {
        const apiDir = path.join(ROOT, 'app', 'api');
        const routes = listFiles(apiDir, (file) => path.basename(file) === 'route.js')
            .map((file) => ({ name: path.relative(apiDir, path.dirname(file)).split(path.sep).join('/'), source: read(file) }));
        const allowed = new Set(Object.values(PUBLIC_API_ROUTES).flat());
        const unchecked = routes.filter((route) => !AUTH_MARKERS.test(route.source)).map((route) => route.name);
        expect(unchecked.filter((name) => !allowed.has(name))).toEqual([]);
        // รายการต้องไม่ค้าง: route ที่ลบไปแล้ว หรือเพิ่มการตรวจสิทธิ์แล้ว ให้เอาออกจากรายการด้วย
        expect([...allowed].filter((name) => !unchecked.includes(name))).toEqual([]);
    });

    test('re-exported vulnerable-group routes point at routes that require login', () => {
        for (const name of PUBLIC_API_ROUTES['ส่งต่อไปยัง route ที่ตรวจสิทธิ์แล้ว (re-export)']) {
            const target = /from ['"]@\/(app\/api\/[^'"]+)['"]/.exec(read(path.join(ROOT, 'app', 'api', name, 'route.js')))?.[1];
            expect(target).toBeTruthy();
            expect(read(path.join(ROOT, `${target}.js`))).toMatch(/requireAuth\(/);
        }
    });
});
