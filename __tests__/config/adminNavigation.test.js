import fs from 'fs';
import path from 'path';
import { buildAdminMenu, buildEventSections, isMenuItemActive } from '@/src/config/navigation/admin-navigation';

const ROOT = process.env.STN_ROOT || path.resolve(__dirname, '../..');

function pageExists(href) {
    const pathname = href.split('?')[0];
    const direct = path.join(ROOT, 'app', pathname, 'page.jsx');
    if (fs.existsSync(direct)) return true;
    // dynamic segment เช่น /admin/master-data/[type]
    const parent = path.join(ROOT, 'app', path.dirname(pathname));
    return fs.existsSync(parent) && fs.readdirSync(parent).some((name) => /^\[.+\]$/.test(name) && fs.existsSync(path.join(parent, name, 'page.jsx')));
}

describe('admin navigation', () => {
    const eocStatus = {
        flood: { is_active: true, session_id: 12, session_number: 5 },
        disease: { is_active: false },
        'festival-accidents': { is_active: false }
    };

    test('every menu link points to a real page', () => {
        const menu = buildAdminMenu({ eocStatus: { flood: { is_active: true }, disease: { is_active: true }, 'festival-accidents': { is_active: true } } });
        const broken = menu.flatMap((section) => section.items).map((item) => item.path).filter((href) => !pageExists(href));
        expect(broken).toEqual([]);
    });

    test('lists only open events, expanded, with the session number', () => {
        const events = buildEventSections({ eocStatus, pathname: '/dashboard' });
        expect(events.map((section) => section.title)).toEqual(['อุทกภัย ครั้งที่ 5']);
        expect(events[0]).toMatchObject({ eventState: 'open', defaultExpanded: true });
        expect(events[0].items.find((item) => item.key === 'shelters').path).toBe('/eoc/shelters?eoc=flood&session=12');
    });

    test('shows a closed event only while viewing its pages', () => {
        const events = buildEventSections({ eocStatus, pathname: '/eoc/disease/records' });
        expect(events.find((section) => section.eocType === 'disease')).toMatchObject({ eventState: 'closed' });
    });

    test('offers to open an EOC when nothing is open', () => {
        const heading = buildAdminMenu({ eocStatus: {} }).find((section) => section.section === 'events-heading');
        expect(heading.emptyMessage).toBe('ยังไม่มีเหตุการณ์ที่เปิดอยู่');
        expect(heading.items[0].path).toBe('/admin/eoc-management');
    });

    test('distinguishes tabs of the same page', () => {
        const registry = { path: '/eoc/shelters?tab=registry' };
        const session = { path: '/eoc/shelters?eoc=flood&session=12' };
        expect(isMenuItemActive(registry, '/eoc/shelters', '?tab=registry')).toBe(true);
        expect(isMenuItemActive(session, '/eoc/shelters', '?tab=registry')).toBe(false);
        expect(isMenuItemActive(session, '/eoc/shelters/', '')).toBe(true);
        expect(isMenuItemActive(registry, '/eoc/shelters-x', '?tab=registry')).toBe(false);
    });
});
