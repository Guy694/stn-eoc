import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { publicInternalError } from '@/lib/apiResponse';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const district = searchParams.get('district');
        const search = searchParams.get('search');
        const hotlineOnly = searchParams.get('hotline') === 'true';

        let sql = `
            SELECT
                id,
                slug,
                name,
                role_description,
                area,
                phone,
                secondary_contact,
                category,
                status,
                is_hotline,
                sort_order
            FROM agency_contacts
            WHERE is_active = 1
        `;
        const params = [];

        if (category && category !== 'all') {
            sql += ' AND category = ?';
            params.push(category);
        }

        if (district && district !== 'all') {
            sql += ' AND area = ?';
            params.push(district);
        }

        if (hotlineOnly) {
            sql += ' AND is_hotline = 1';
        }

        if (search) {
            sql += `
                AND (
                    name LIKE ?
                    OR role_description LIKE ?
                    OR area LIKE ?
                    OR phone LIKE ?
                    OR secondary_contact LIKE ?
                )
            `;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY is_hotline DESC, sort_order ASC, name ASC';

        const contacts = await query(sql, params);
        const normalizedContacts = contacts.map((item) => ({
            ...item,
            is_hotline: Boolean(item.is_hotline)
        }));

        const directoryContacts = normalizedContacts.filter((item) => !item.is_hotline);
        const districtCount = new Set(
            directoryContacts
                .map((item) => item.area)
                .filter((area) => area && String(area).startsWith('อ.'))
        ).size;

        const stats = {
            total: directoryContacts.length,
            hotlines: normalizedContacts.filter((item) => item.is_hotline).length,
            medical: directoryContacts.filter((item) => item.category === 'medical').length,
            safety: directoryContacts.filter((item) => item.category === 'safety').length,
            local: directoryContacts.filter((item) => item.category === 'local').length,
            districts: districtCount || 7
        };

        return NextResponse.json({
            success: true,
            data: normalizedContacts,
            stats
        });
    } catch (error) {
        console.error('Error fetching agency contacts:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลติดต่อหน่วยงาน');
    }
}
