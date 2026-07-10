import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DISEASE_NAME = 'ไข้เลือดออก';

const DISTRICT_POPULATIONS = {
    "เมืองสตูล": 116400,
    "ควนโดน": 23300,
    "ควนกาหลง": 43800,
    "ท่าแพ": 29900,
    "ละงู": 76000,
    "ทุ่งหว้า": 26500,
    "มะนัง": 19900
};

const DISEASE_CODE_NAMES = {
    DF: { th: 'ไข้เดงกี', en: 'Dengue fever' },
    DHF: { th: 'ไข้เลือดออกเดงกี', en: 'Dengue haemorrhagic fever' },
    DSS: { th: 'ไข้เลือดออกเดงกีช็อก', en: 'Dengue shock syndrome' }
};

function dateToIso(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0, 10);
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getIsoWeek(value) {
    const [year, month, dayOfMonth] = dateToIso(value).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return { year: date.getUTCFullYear(), week };
}

function getFiscalYearKey(value) {
    const iso = dateToIso(value);
    const year = Number(iso.slice(0, 4));
    return String(year + 543);
}

function getAgeGroup(age) {
    const value = Number(age);
    if (!Number.isFinite(value)) return 'ไม่ระบุ';
    if (value <= 4) return '0-4 ปี';
    if (value <= 9) return '5-9 ปี';
    if (value <= 14) return '10-14 ปี';
    if (value <= 24) return '15-24 ปี';
    if (value <= 34) return '25-34 ปี';
    if (value <= 44) return '35-44 ปี';
    if (value <= 54) return '45-54 ปี';
    if (value <= 64) return '55-64 ปี';
    return '65 ปีขึ้นไป';
}

function addToMap(map, key, amount) {
    map.set(key, (map.get(key) || 0) + Number(amount || 0));
}

function getRiskLevel(totalCases, newCases, population) {
    const morbidityRate = population > 0 ? (totalCases / population) * 100000 : 0;
    if (morbidityRate >= 65 || newCases >= 15) return 'ระบาด';
    if (morbidityRate >= 35 || newCases >= 5) return 'เฝ้าระวังสูง';
    if (totalCases > 0) return 'เฝ้าระวัง';
    return 'ปกติ';
}

async function hasDiseaseMetadataColumns(pool) {
    const [columns] = await pool.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'disease_reports'
           AND COLUMN_NAME IN ('disease_code', 'patient_type', 'sex', 'age_years', 'agency')`
    );
    return new Set(columns.map((column) => column.COLUMN_NAME));
}

async function getActiveSession(pool, sessionId) {
    if (sessionId) {
        const [rows] = await pool.query(
            `SELECT id, session_number, disease_name, opened_at, status
             FROM eoc_sessions
             WHERE id = ? AND eoc_type = 'disease'
             LIMIT 1`,
            [sessionId]
        );
        return rows[0] || null;
    }

    const [rows] = await pool.query(
        `SELECT id, session_number, disease_name, opened_at, status
         FROM eoc_sessions
         WHERE eoc_type = 'disease'
           AND status = 'active'
           AND (disease_name IS NULL OR disease_name LIKE ?)
         ORDER BY opened_at DESC, id DESC
         LIMIT 1`,
        [`%${DISEASE_NAME}%`]
    );
    return rows[0] || null;
}

export async function GET(request) {
    try {
        const pool = await getConnection();
        const { searchParams } = new URL(request.url);
        const session = await getActiveSession(pool, searchParams.get('session_id'));

        if (!session) {
            return NextResponse.json({
                success: false,
                message: 'ไม่พบ EOC โรคไข้เลือดออกที่เปิดอยู่'
            }, { status: 404 });
        }

        const metadataColumns = await hasDiseaseMetadataColumns(pool);
        const diseaseCodeSelect = metadataColumns.has('disease_code') ? 'dr.disease_code' : 'NULL';
        const patientTypeSelect = metadataColumns.has('patient_type') ? 'dr.patient_type' : 'NULL';
        const sexSelect = metadataColumns.has('sex') ? 'dr.sex' : 'NULL';
        const ageSelect = metadataColumns.has('age_years') ? 'dr.age_years' : 'NULL';
        const agencySelect = metadataColumns.has('agency') ? 'dr.agency' : 'NULL';

        const [rows] = await pool.query(
            `SELECT
                dr.report_date,
                COALESCE(dr.district_name, hf.district_name) as district_name,
                COALESCE(dr.patient_count, 0) as patient_count,
                ${diseaseCodeSelect} as disease_code,
                ${patientTypeSelect} as patient_type,
                ${sexSelect} as sex,
                ${ageSelect} as age_years,
                ${agencySelect} as agency,
                dr.updated_at
             FROM disease_reports dr
             LEFT JOIN health_facilities hf ON dr.health_facility_id = hf.id
             WHERE dr.session_id = ?
               AND dr.disease_name = ?
             ORDER BY dr.report_date ASC, district_name ASC`,
            [session.id, DISEASE_NAME]
        );

        const weekMap = new Map();
        const districtMap = new Map();
        const districtWeekMap = new Map();
        const patientTypeMap = new Map();
        const ageSexMap = new Map();
        const diseaseCodeMap = new Map();
        let minDate = '';
        let maxDate = '';
        let lastUpdated = null;

        for (const row of rows) {
            const reportDate = dateToIso(row.report_date);
            const amount = Number(row.patient_count || 0);
            const district = row.district_name || 'ไม่ระบุ';
            const weekInfo = getIsoWeek(row.report_date);
            const weekKey = `${weekInfo.year}-W${String(weekInfo.week).padStart(2, '0')}`;

            if (!minDate || reportDate < minDate) minDate = reportDate;
            if (!maxDate || reportDate > maxDate) maxDate = reportDate;
            if (!lastUpdated || new Date(row.updated_at) > new Date(lastUpdated)) lastUpdated = row.updated_at;

            addToMap(weekMap, weekKey, amount);
            addToMap(districtMap, district, amount);
            addToMap(patientTypeMap, row.patient_type || 'ไม่ระบุ', amount);
            addToMap(diseaseCodeMap, row.disease_code || 'ไม่ระบุ', amount);

            if (!districtWeekMap.has(district)) districtWeekMap.set(district, new Map());
            addToMap(districtWeekMap.get(district), weekKey, amount);

            const ageGroup = getAgeGroup(row.age_years);
            if (!ageSexMap.has(ageGroup)) ageSexMap.set(ageGroup, { age_group: ageGroup, male: 0, female: 0, unknown: 0 });
            const ageRow = ageSexMap.get(ageGroup);
            if (row.sex === 'ชาย') ageRow.male += amount;
            else if (row.sex === 'หญิง') ageRow.female += amount;
            else ageRow.unknown += amount;
        }

        const weekKeys = Array.from(weekMap.keys()).sort();
        const currentYearKey = maxDate ? getFiscalYearKey(maxDate) : '2569';
        const previousWeekKey = weekKeys.at(-2);
        const latestWeekKey = weekKeys.at(-1);
        const latestWeekNumber = latestWeekKey ? Number(latestWeekKey.slice(-2)) : 0;
        const totalCases = rows.reduce((sum, row) => sum + Number(row.patient_count || 0), 0);

        const weeklyTrend = weekKeys.map((weekKey) => ({
            epi_week: Number(weekKey.slice(-2)),
            week_key: weekKey,
            [currentYearKey]: weekMap.get(weekKey) || 0,
            baseline: 0
        }));

        const districtCases = Array.from(districtMap.entries())
            .map(([districtName, total]) => {
                const districtWeeks = districtWeekMap.get(districtName) || new Map();
                const newCases = latestWeekKey ? districtWeeks.get(latestWeekKey) || 0 : 0;
                const previousWeek = previousWeekKey ? districtWeeks.get(previousWeekKey) || 0 : 0;
                const population = DISTRICT_POPULATIONS[districtName] || 1;
                const riskLevel = getRiskLevel(total, newCases, population);
                const ageCounts = new Map();
                rows
                    .filter((row) => (row.district_name || 'ไม่ระบุ') === districtName)
                    .forEach((row) => addToMap(ageCounts, getAgeGroup(row.age_years), row.patient_count));
                const topAgeGroup = Array.from(ageCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ไม่ระบุ';

                return {
                    district_name: districtName,
                    total_cases: total,
                    new_cases: newCases,
                    deaths: 0,
                    previous_week: previousWeek,
                    top_age_group: topAgeGroup,
                    risk_level: riskLevel
                };
            })
            .sort((a, b) => b.total_cases - a.total_cases);

        const districtWeekly = districtCases.map((district) => {
            const districtWeeks = districtWeekMap.get(district.district_name) || new Map();
            return {
                district_name: district.district_name,
                weeks: weekKeys.map((weekKey) => districtWeeks.get(weekKey) || 0)
            };
        });

        const patientTypes = Array.from(patientTypeMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const ageOrder = ['0-4 ปี', '5-9 ปี', '10-14 ปี', '15-24 ปี', '25-34 ปี', '35-44 ปี', '45-54 ปี', '55-64 ปี', '65 ปีขึ้นไป', 'ไม่ระบุ'];
        const ageSex = ageOrder
            .map((ageGroup) => ageSexMap.get(ageGroup) || { age_group: ageGroup, male: 0, female: 0, unknown: 0 })
            .filter((item) => item.male || item.female || item.unknown);

        const diseaseCodes = Array.from(diseaseCodeMap.entries())
            .map(([code, cases]) => ({
                disease_code: code,
                disease_name_th: DISEASE_CODE_NAMES[code]?.th || code,
                disease_name_en: DISEASE_CODE_NAMES[code]?.en || code,
                cases,
                previous_week_change: 0
            }))
            .sort((a, b) => b.cases - a.cases);

        const latestWeekCases = latestWeekKey ? weekMap.get(latestWeekKey) || 0 : 0;
        const outbreakLevel = totalCases >= 300 || latestWeekCases >= 30
            ? 'ระบาด'
            : totalCases >= 100 || latestWeekCases >= 10
                ? 'เฝ้าระวังสูง'
                : totalCases > 0
                    ? 'เฝ้าระวัง'
                    : 'ปกติ';

        return NextResponse.json({
            success: true,
            data: {
                report_year: maxDate ? Number(maxDate.slice(0, 4)) : new Date().getFullYear(),
                fiscal_year: Number(currentYearKey),
                province_code: '91',
                province_name: 'สตูล',
                disease_code: 'A90/A91',
                disease_name_th: 'โรคไข้เลือดออก',
                disease_name_en: 'Dengue fever',
                disease_group: 'โรคติดต่อนำโดยยุงลาย',
                outbreak_level: outbreakLevel,
                last_updated: lastUpdated || new Date().toISOString(),
                latest_epi_week: latestWeekNumber,
                week_labels: weekKeys.map((weekKey) => `W${Number(weekKey.slice(-2))}`),
                current_year_key: currentYearKey,
                opened_at: session.opened_at,
                source: 'Raw_Dengue.csv',
                source_rows: rows.length,
                period: { first_date: minDate, last_date: maxDate },
                weeklyTrend,
                districtCases,
                districtWeekly,
                patientTypes,
                ageSex,
                diseaseCodes
            }
        });
    } catch (error) {
        console.error('Disease outbreak dashboard error:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล dashboard โรคไข้เลือดออก'
        }, { status: 500 });
    }
}
