import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '@/lib/db';
import { getRouteAdvice, isRouteAdviceQuestion } from '@/lib/routeAdvice';
import { notifySecurityEvent } from '@/lib/telegram';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SENSITIVE_IDENTIFIER_PATTERNS = [
    /pid/i,
    /citizen/i,
    /thaiid/i,
    /id_card/i,
    /passport/i,
    /phone/i,
    /mobile/i,
    /tel/i,
    /email/i,
    /address/i,
    /birth(date)?/i,
    /first_name/i,
    /last_name/i,
    /given_name/i,
    /family_name/i,
    /fullname/i,
    /name$/i,
    /secret/i,
    /password/i,
    /token/i,
    /cookie/i,
    /session/i,
    /hash/i,
    /consent/i,
    /exact_location/i
];

const FLOOD_KNOWLEDGE_PATTERNS = [
    /น้ำท่วม/i,
    /อุทกภัย/i,
    /น้ำหลาก/i,
    /น้ำป่า/i,
    /น้ำขัง/i,
    /ระดับน้ำ/i,
    /ระบายน้ำ/i,
    /เขื่อน/i,
    /คลอง/i,
    /แม่น้ำ/i,
    /ฝนตกหนัก/i,
    /พายุ/i,
    /น้ำทะเลหนุน/i,
    /flood/i,
    /flooding/i,
    /heavy rain/i,
    /storm/i
];

const DISEASE_KNOWLEDGE_PATTERNS = [
    /โรค/i,
    /ระบาด/i,
    /ผู้ป่วย/i,
    /ติดเชื้อ/i,
    /เชื้อ/i,
    /วัคซีน/i,
    /สุขภาพ/i,
    /ไข้/i,
    /ไอ/i,
    /ท้องเสีย/i,
    /อาหารเป็นพิษ/i,
    /ไข้เลือดออก/i,
    /ยุงลาย/i,
    /โควิด/i,
    /covid/i,
    /ไข้หวัดใหญ่/i,
    /มือเท้าปาก/i,
    /ฉี่หนู/i,
    /leptospirosis/i,
    /อหิวา/i,
    /disease/i,
    /outbreak/i,
    /infection/i,
    /public health/i
];

const WEATHER_KNOWLEDGE_PATTERNS = [
    /อากาศ/i,
    /สภาพอากาศ/i,
    /ฟ้าฝน/i,
    /ฝน/i,
    /ฝนตก/i,
    /พยากรณ์/i,
    /พยากรณ์อากาศ/i,
    /อุณหภูมิ/i,
    /ความชื้น/i,
    /ลม/i,
    /ลมแรง/i,
    /มรสุม/i,
    /หย่อมความกดอากาศ/i,
    /กรมอุตุ/i,
    /เรดาร์ฝน/i,
    /weather/i,
    /forecast/i,
    /rain/i,
    /rainfall/i,
    /temperature/i,
    /humidity/i,
    /monsoon/i,
    /radar/i
];

function isSensitiveIdentifier(value) {
    if (!value) return false;
    return SENSITIVE_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(String(value)));
}

function filterSchemaForPdpa(rawSchema) {
    const safeSchema = {};

    for (const [tableName, tableDef] of Object.entries(rawSchema)) {
        if (isSensitiveIdentifier(tableName)) continue;

        const safeColumns = (tableDef.columns || []).filter((col) => {
            return !isSensitiveIdentifier(col.name) && !isSensitiveIdentifier(col.comment);
        });

        if (safeColumns.length > 0) {
            safeSchema[tableName] = {
                comment: tableDef.comment || '',
                columns: safeColumns
            };
        }
    }

    return safeSchema;
}

function containsSensitiveSql(sql) {
    if (!sql) return false;
    const lowered = String(sql).toLowerCase();
    return SENSITIVE_IDENTIFIER_PATTERNS.some((pattern) => {
        const source = pattern.source.replace(/^\^/, '').replace(/\$$/, '');
        const simple = source.replace(/\\/g, '');
        if (!simple || simple.includes('(') || simple.includes('[') || simple.includes('|')) return false;
        const matcher = new RegExp(`\\b${simple}\\b`, 'i');
        return matcher.test(lowered);
    });
}

function redactSensitiveFields(rows) {
    return rows.map((row) => {
        const sanitized = {};
        for (const [key, value] of Object.entries(row)) {
            if (isSensitiveIdentifier(key)) continue;
            sanitized[key] = value;
        }
        return sanitized;
    });
}

function detectAllowedKnowledgeDomain(message) {
    const text = String(message || '');
    const isFlood = FLOOD_KNOWLEDGE_PATTERNS.some((pattern) => pattern.test(text));
    const isDisease = DISEASE_KNOWLEDGE_PATTERNS.some((pattern) => pattern.test(text));
    const isWeather = WEATHER_KNOWLEDGE_PATTERNS.some((pattern) => pattern.test(text));
    const domains = [];

    if (isFlood) domains.push('flood');
    if (isDisease) domains.push('disease');
    if (isWeather) domains.push('weather');

    return domains.length > 0 ? domains.join('_and_') : null;
}

function getKnowledgeDomainLabel(domain) {
    if (domain === 'flood') return 'อุทกภัยน้ำท่วม';
    if (domain === 'disease') return 'โรคและการระบาด';
    if (domain === 'weather') return 'สภาพฟ้าฝนและอากาศ';
    return 'โรค/การระบาด อุทกภัยน้ำท่วม และสภาพฟ้าฝน/อากาศ';
}

function buildConversationContext(conversationHistory) {
    if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) {
        return 'ไม่มีประวัติการสนทนาก่อนหน้า';
    }

    return conversationHistory
        .slice(-5)
        .map((item) => {
            const role = item?.role === 'assistant' ? 'ผู้ช่วย' : 'ผู้ใช้';
            const content = String(item?.content || '').slice(0, 1000);
            return `${role}: ${content}`;
        })
        .join('\n');
}

function buildScopeAnswer() {
    return 'ขออภัยครับ ตอนนี้ EOC Assistant ตอบข้อมูลนอกฐานข้อมูลเฉพาะเรื่องโรค/การระบาด อุทกภัยน้ำท่วม และสภาพฟ้าฝน/อากาศเท่านั้น หากต้องการถามข้อมูลในระบบ EOC กรุณาถามเป็นข้อมูลสถานการณ์ เหตุการณ์ หรือสถิติภาพรวมที่เกี่ยวข้องกับระบบครับ';
}

function buildAssistantUnavailableAnswer(domain) {
    const label = domain ? getKnowledgeDomainLabel(domain) : 'ข้อมูล EOC';
    return `คำถามนี้อยู่ในขอบเขต${label}ครับ แต่ขณะนี้ระบบ AI สำหรับแปลงคำถามเป็นข้อมูลเชิงลึกยังไม่พร้อมใช้งาน จึงยังตอบคำถามแบบอิสระจากฐานข้อมูลไม่ได้ชั่วคราว\nหากถามเป็นคำถามที่ระบบรองรับโดยตรง เช่น อำเภอไหนมีไข้เลือดออกมากที่สุด ระบบจะตอบจากฐานข้อมูลให้ทันทีครับ`;
}

function createAssistantUnavailableResponse({ domain = null, reason = 'ai_unavailable' } = {}) {
    return Response.json({
        success: true,
        data: {
            answer: buildAssistantUnavailableAnswer(domain),
            sql: null,
            results: null,
            resultCount: 0,
            source: reason,
            domain
        }
    });
}

function createBasicDatabaseAnswer({ message, results }) {
    const rows = Array.isArray(results) ? results : [];

    if (rows.length === 0) {
        return 'ไม่พบข้อมูลตามคำถามนี้ในฐานข้อมูลครับ';
    }

    const previewRows = rows.slice(0, 5).map((row, index) => {
        const fields = Object.entries(row)
            .slice(0, 5)
            .map(([key, value]) => `${key}: ${value ?? '-'}`)
            .join(', ');
        return `${index + 1}. ${fields}`;
    });

    return [
        `พบข้อมูลจากฐานข้อมูล ${formatThaiNumber(rows.length)} รายการสำหรับคำถาม "${message}" ครับ`,
        'ระบบ AI สำหรับสรุปภาษาธรรมชาติมีปัญหาชั่วคราว จึงแสดงผลลัพธ์สำคัญแบบย่อ:',
        previewRows.join('\n')
    ].join('\n');
}

const DENGUE_DISEASE_NAME = 'ไข้เลือดออก';

function includesAny(text, needles) {
    return needles.some((needle) => text.includes(needle));
}

function isDengueDistrictRankingQuestion(message) {
    const text = String(message || '').toLowerCase();

    return includesAny(text, ['ไข้เลือด', 'dengue'])
        && includesAny(text, ['อำเภอ', 'อําเภอ', 'พื้นที่', 'เขต'])
        && includesAny(text, ['มากที่สุด', 'มากสุด', 'สูงสุด', 'เยอะสุด', 'เยอะที่สุด', 'อันดับ', 'top']);
}

function isDengueSummaryQuestion(message) {
    const text = String(message || '').toLowerCase();

    return includesAny(text, ['ไข้เลือด', 'dengue'])
        && includesAny(text, ['กี่ราย', 'ทั้งหมด', 'รวม', 'สรุป', 'สถานการณ์', 'ผู้ป่วย', 'รายงาน']);
}

function isFloodStatusQuestion(message) {
    const text = String(message || '').toLowerCase();

    return includesAny(text, ['น้ำท่วม', 'อุทกภัย', 'flood'])
        && includesAny(text, ['ที่ไหน', 'พื้นที่', 'อำเภอ', 'อําเภอ', 'ตำบล', 'ตําบล', 'หมู่บ้าน', 'ได้รับผล', 'สรุป', 'สถานการณ์', 'มากที่สุด', 'สูงสุด']);
}

function formatThaiNumber(value) {
    return Number(value || 0).toLocaleString('th-TH');
}

function formatThaiDate(value) {
    if (!value) return null;
    return new Intl.DateTimeFormat('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Bangkok'
    }).format(new Date(value));
}

async function getLatestDengueSession() {
    const rows = await query(
        `SELECT id, session_number, status, disease_name, opened_at, closed_at
         FROM eoc_sessions
         WHERE eoc_type = 'disease'
           AND (disease_name IS NULL OR disease_name LIKE ?)
         ORDER BY (status = 'active') DESC, opened_at DESC, id DESC
         LIMIT 1`,
        [`%${DENGUE_DISEASE_NAME}%`]
    );

    return rows[0] || null;
}

async function createDengueDistrictRankingResponse() {
    const session = await getLatestDengueSession();

    if (!session) {
        return Response.json({
            success: true,
            data: {
                answer: 'ยังไม่พบข้อมูล EOC โรคไข้เลือดออกในระบบครับ',
                sql: null,
                results: [],
                resultCount: 0,
                source: 'database_deterministic'
            }
        });
    }

    const districtRows = await query(
        `SELECT
            COALESCE(NULLIF(dr.district_name, ''), NULLIF(hf.district_name, ''), 'ไม่ระบุ') AS district_name,
            COALESCE(SUM(dr.patient_count), 0) AS patient_count,
            COUNT(*) AS report_count
         FROM disease_reports dr
         LEFT JOIN health_facilities hf ON dr.health_facility_id = hf.id
         WHERE dr.session_id = ?
           AND dr.disease_name = ?
         GROUP BY district_name
         ORDER BY patient_count DESC, district_name ASC`,
        [session.id, DENGUE_DISEASE_NAME]
    );

    const rankedDistricts = districtRows
        .map((row) => ({
            district_name: row.district_name,
            patient_count: Number(row.patient_count || 0),
            report_count: Number(row.report_count || 0)
        }))
        .filter((row) => row.patient_count > 0);

    if (rankedDistricts.length === 0) {
        return Response.json({
            success: true,
            data: {
                answer: `พบ EOC โรคไข้เลือดออก session ${session.session_number || session.id} แต่ยังไม่มีรายงานผู้ป่วยในระบบครับ`,
                sql: null,
                results: [],
                resultCount: 0,
                source: 'database_deterministic',
                session
            }
        });
    }

    const topDistrict = rankedDistricts[0];
    const totalPatients = rankedDistricts.reduce((sum, row) => sum + row.patient_count, 0);
    const openedDate = formatThaiDate(session.opened_at);
    const topList = rankedDistricts
        .slice(0, 5)
        .map((row, index) => `${index + 1}. ${row.district_name} ${formatThaiNumber(row.patient_count)} ราย`)
        .join('\n');

    const answer = [
        `อำเภอที่มีผู้ป่วยไข้เลือดออกมากที่สุดคือ อำเภอ${topDistrict.district_name} ${formatThaiNumber(topDistrict.patient_count)} รายครับ`,
        `อ้างอิงข้อมูล EOC โรคไข้เลือดออก session ${session.session_number || session.id}${openedDate ? ` เปิดเมื่อ ${openedDate}` : ''} รวมทั้งหมด ${formatThaiNumber(totalPatients)} ราย`,
        `อันดับผู้ป่วยสะสมสูงสุด:\n${topList}`
    ].join('\n');

    return Response.json({
        success: true,
        data: {
            answer,
            sql: null,
            results: rankedDistricts,
            resultCount: rankedDistricts.length,
            source: 'database_deterministic',
            session
        }
    });
}

async function createDengueSummaryResponse() {
    const session = await getLatestDengueSession();

    if (!session) {
        return Response.json({
            success: true,
            data: {
                answer: 'ยังไม่พบข้อมูล EOC โรคไข้เลือดออกในระบบครับ',
                sql: null,
                results: [],
                resultCount: 0,
                source: 'database_deterministic'
            }
        });
    }

    const districtRows = await query(
        `SELECT
            COALESCE(NULLIF(dr.district_name, ''), NULLIF(hf.district_name, ''), 'ไม่ระบุ') AS district_name,
            COALESCE(SUM(dr.patient_count), 0) AS patient_count,
            COUNT(*) AS report_count,
            MIN(dr.report_date) AS first_report_date,
            MAX(dr.report_date) AS latest_report_date
         FROM disease_reports dr
         LEFT JOIN health_facilities hf ON dr.health_facility_id = hf.id
         WHERE dr.session_id = ?
           AND dr.disease_name = ?
         GROUP BY district_name
         ORDER BY patient_count DESC, district_name ASC`,
        [session.id, DENGUE_DISEASE_NAME]
    );

    const rankedDistricts = districtRows.map((row) => ({
        district_name: row.district_name,
        patient_count: Number(row.patient_count || 0),
        report_count: Number(row.report_count || 0),
        first_report_date: row.first_report_date,
        latest_report_date: row.latest_report_date
    }));
    const totalPatients = rankedDistricts.reduce((sum, row) => sum + row.patient_count, 0);
    const firstReport = rankedDistricts.map((row) => row.first_report_date).filter(Boolean).sort()[0];
    const latestReport = rankedDistricts.map((row) => row.latest_report_date).filter(Boolean).sort().at(-1);
    const topList = rankedDistricts
        .slice(0, 5)
        .map((row, index) => `${index + 1}. ${row.district_name} ${formatThaiNumber(row.patient_count)} ราย`)
        .join('\n');

    const answer = totalPatients > 0
        ? [
            `EOC โรคไข้เลือดออก session ${session.session_number || session.id} มีผู้ป่วยรวม ${formatThaiNumber(totalPatients)} ราย จาก ${formatThaiNumber(rankedDistricts.length)} อำเภอครับ`,
            firstReport && latestReport ? `ช่วงข้อมูลรายงาน ${formatThaiDate(firstReport)} - ${formatThaiDate(latestReport)}` : null,
            `อำเภอที่มีผู้ป่วยสูงสุด:\n${topList}`
        ].filter(Boolean).join('\n')
        : `พบ EOC โรคไข้เลือดออก session ${session.session_number || session.id} แต่ยังไม่มีรายงานผู้ป่วยในระบบครับ`;

    return Response.json({
        success: true,
        data: {
            answer,
            sql: null,
            results: rankedDistricts,
            resultCount: rankedDistricts.length,
            source: 'database_deterministic',
            session
        }
    });
}

async function getLatestFloodSession() {
    const rows = await query(
        `SELECT
            s.id,
            s.session_number,
            s.status,
            s.opened_at,
            s.closed_at,
            COUNT(f.id) AS record_count,
            MAX(f.flood_start_date) AS latest_record_date
         FROM eoc_sessions s
         LEFT JOIN flood_records f ON f.session_id = s.id
         WHERE LOWER(s.eoc_type) = 'flood'
         GROUP BY s.id, s.session_number, s.status, s.opened_at, s.closed_at
         ORDER BY (s.status = 'active') DESC, MAX(f.flood_start_date) DESC, s.opened_at DESC, s.id DESC
         LIMIT 1`
    );

    return rows[0] || null;
}

async function createFloodStatusResponse() {
    const session = await getLatestFloodSession();

    if (!session) {
        return Response.json({
            success: true,
            data: {
                answer: 'ยังไม่พบข้อมูล EOC น้ำท่วมในระบบครับ',
                sql: null,
                results: [],
                resultCount: 0,
                source: 'database_deterministic'
            }
        });
    }

    if (Number(session.record_count || 0) === 0) {
        return Response.json({
            success: true,
            data: {
                answer: `พบ EOC น้ำท่วม session ${session.session_number || session.id} สถานะ${session.status === 'active' ? 'เปิดอยู่' : 'ปิดแล้ว'} แต่ยังไม่มีข้อมูลรายงานน้ำท่วมในระบบครับ`,
                sql: null,
                results: [],
                resultCount: 0,
                source: 'database_deterministic',
                session
            }
        });
    }

    const latestRows = await query(
        `SELECT
            COALESCE(
                MAX(CASE WHEN f.flood_level <> 'ไม่มี' THEN f.flood_start_date END),
                MAX(f.flood_start_date)
            ) AS latest_date
         FROM flood_records f
         WHERE f.session_id = ?`,
        [session.id]
    );
    const latestDate = latestRows[0]?.latest_date;

    const affectedRows = await query(
        `SELECT
            COALESCE(NULLIF(f.district, ''), NULLIF(v.distname, ''), 'ไม่ระบุ') AS district_name,
            COALESCE(NULLIF(f.tambon, ''), NULLIF(v.subdistnam, ''), 'ไม่ระบุ') AS tambon_name,
            COALESCE(NULLIF(f.village, ''), NULLIF(v.villname, ''), 'ไม่ระบุ') AS village_name,
            f.flood_level,
            COALESCE(f.water_depth_cm, 0) AS water_depth_cm,
            COALESCE(f.affected_households, 0) AS affected_households,
            COALESCE(f.affected_people, 0) AS affected_people
         FROM flood_records f
         LEFT JOIN satun_village_polygon v ON f.polygon_id = v.id
         WHERE f.session_id = ?
           AND DATE(f.flood_start_date) = DATE(?)
           AND f.flood_level <> 'ไม่มี'
         ORDER BY
            CASE f.flood_level WHEN 'สูงมาก' THEN 4 WHEN 'สูง' THEN 3 WHEN 'ปานกลาง' THEN 2 WHEN 'ต่ำ' THEN 1 ELSE 0 END DESC,
            affected_people DESC,
            district_name ASC,
            tambon_name ASC,
            village_name ASC
         LIMIT 20`,
        [session.id, latestDate]
    );

    const districtRows = await query(
        `SELECT
            COALESCE(NULLIF(f.district, ''), NULLIF(v.distname, ''), 'ไม่ระบุ') AS district_name,
            COUNT(*) AS affected_villages,
            COALESCE(SUM(f.affected_households), 0) AS affected_households,
            COALESCE(SUM(f.affected_people), 0) AS affected_people,
            COALESCE(MAX(f.water_depth_cm), 0) AS max_water_depth_cm
         FROM flood_records f
         LEFT JOIN satun_village_polygon v ON f.polygon_id = v.id
         WHERE f.session_id = ?
           AND DATE(f.flood_start_date) = DATE(?)
           AND f.flood_level <> 'ไม่มี'
         GROUP BY district_name
         ORDER BY affected_villages DESC, affected_people DESC, district_name ASC`,
        [session.id, latestDate]
    );

    const normalizedDistricts = districtRows.map((row) => ({
        district_name: row.district_name,
        affected_villages: Number(row.affected_villages || 0),
        affected_households: Number(row.affected_households || 0),
        affected_people: Number(row.affected_people || 0),
        max_water_depth_cm: Number(row.max_water_depth_cm || 0)
    }));

    const totalVillages = normalizedDistricts.reduce((sum, row) => sum + row.affected_villages, 0);
    const totalPeople = normalizedDistricts.reduce((sum, row) => sum + row.affected_people, 0);
    const districtList = normalizedDistricts
        .slice(0, 5)
        .map((row, index) => `${index + 1}. ${row.district_name} ${formatThaiNumber(row.affected_villages)} หมู่บ้าน${row.affected_people ? ` / ${formatThaiNumber(row.affected_people)} คน` : ''}`)
        .join('\n');
    const villageList = affectedRows
        .slice(0, 5)
        .map((row, index) => `${index + 1}. ${row.village_name} ต.${row.tambon_name} อ.${row.district_name} ระดับ${row.flood_level}`)
        .join('\n');

    const latestDateText = formatThaiDate(latestDate);
    const sessionStatusText = session.status === 'active' ? 'เปิดอยู่' : 'ปิดแล้ว';
    const answer = totalVillages > 0
        ? [
            `ข้อมูลน้ำท่วมล่าสุดวันที่ ${latestDateText} จาก EOC session ${session.session_number || session.id} (${sessionStatusText}) พบพื้นที่ได้รับผลกระทบ ${formatThaiNumber(totalVillages)} หมู่บ้าน ใน ${formatThaiNumber(normalizedDistricts.length)} อำเภอ${totalPeople ? ` รวมประชาชน ${formatThaiNumber(totalPeople)} คน` : ''}ครับ`,
            `สรุปรายอำเภอ:\n${districtList}`,
            villageList ? `พื้นที่ตัวอย่างที่มีระดับน้ำท่วม:\n${villageList}` : null
        ].filter(Boolean).join('\n')
        : `ข้อมูลน้ำท่วมล่าสุดวันที่ ${latestDateText} จาก EOC session ${session.session_number || session.id} (${sessionStatusText}) ไม่พบพื้นที่ที่มีระดับน้ำท่วมในวันดังกล่าวครับ`;

    return Response.json({
        success: true,
        data: {
            answer,
            sql: null,
            results: {
                districts: normalizedDistricts,
                affected_areas: affectedRows
            },
            resultCount: affectedRows.length,
            source: 'database_deterministic',
            session
        }
    });
}

async function createDeterministicDataResponse({ message }) {
    if (isDengueDistrictRankingQuestion(message)) {
        return createDengueDistrictRankingResponse();
    }

    if (isDengueSummaryQuestion(message)) {
        return createDengueSummaryResponse();
    }

    if (isFloodStatusQuestion(message)) {
        return createFloodStatusResponse();
    }

    return null;
}

async function generateKnowledgeAnswer({ model, message, conversationHistory, domain }) {
    const prompt = `คุณเป็น EOC Assistant สำหรับ Satun Geo-EOC จังหวัดสตูล

ขอบเขตคำถามที่อนุญาต: ${getKnowledgeDomainLabel(domain)}

ประวัติสนทนาล่าสุด:
${buildConversationContext(conversationHistory)}

คำถามผู้ใช้:
${message}

แนวทางการตอบ:
1. ตอบเป็นภาษาไทย กระชับ ชัดเจน และใช้งานได้จริง ใช้คำลงท้าย "ครับ" ให้สม่ำเสมอ
2. อนุญาตให้ตอบจากความรู้ทั่วไปนอกฐานข้อมูลได้ เฉพาะเรื่องโรค/การระบาด อุทกภัยน้ำท่วม หรือสภาพฟ้าฝน/อากาศเท่านั้น
3. หากเป็นเรื่องโรค ให้ให้คำแนะนำเชิงสาธารณสุขทั่วไป ไม่วินิจฉัยโรค ไม่สั่งยา และแนะนำพบแพทย์/โทร 1669 เมื่อมีอาการรุนแรง
4. หากเป็นเรื่องน้ำท่วม ให้ให้คำแนะนำด้านความปลอดภัย การเตรียมพร้อม การอพยพ และการเดินทางอย่างระมัดระวัง
5. หากเป็นเรื่องสภาพฟ้าฝน/อากาศ ให้ตอบความหมายของสัญญาณเตือน การเตรียมตัว การอ่านพยากรณ์ และผลกระทบต่อความปลอดภัย
6. ห้ามอ้างว่ารู้ข้อมูลสถานการณ์จริงแบบปัจจุบัน เช่น ถนนปิด จำนวนผู้ป่วย ระดับน้ำ ฝนกำลังตก อุณหภูมิล่าสุด หรือประกาศราชการ เว้นแต่มีข้อมูลจากฐานข้อมูลในคำถามนี้
7. หากต้องใช้ข้อมูลปัจจุบัน ให้บอกว่าควรตรวจสอบจากศูนย์ EOC จังหวัด หน่วยงานท้องถิ่น กรมอุตุนิยมวิทยา หรือช่องทางราชการล่าสุด
8. หากคำถามหลุดจากเรื่องโรค/การระบาด/น้ำท่วม/สภาพอากาศ ให้ปฏิเสธสั้น ๆ และชวนถามในขอบเขตที่รองรับ
9. ไม่ขอหรือเปิดเผยข้อมูลส่วนบุคคล
10. ไม่ใช้ Markdown เช่น **ตัวหนา** หรือตาราง เพราะหน้าจอแชทแสดงเป็นข้อความธรรมดา
11. จำกัดคำตอบไม่เกิน 8 บรรทัดหรือ 8 ข้อ เว้นแต่ผู้ใช้ขอรายละเอียดเพิ่มเติม

ตอบกลับเป็นภาษาไทยเท่านั้น:`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
}

async function createKnowledgeResponse({ model, message, conversationHistory, domain }) {
    let answer;
    try {
        answer = await generateKnowledgeAnswer({
            model,
            message,
            conversationHistory,
            domain
        });
    } catch (knowledgeError) {
        console.error('Failed to generate knowledge response:', knowledgeError);
        return createAssistantUnavailableResponse({
            domain,
            reason: 'knowledge_ai_unavailable'
        });
    }

    return Response.json({
        success: true,
        data: {
            answer,
            sql: null,
            results: null,
            resultCount: 0,
            source: 'general_knowledge',
            source_type: 'general_guidance',
            source_label: 'คำแนะนำทั่วไปจาก AI ไม่ใช่ข้อมูลสถานการณ์จาก EOC',
            generated_at: new Date().toISOString(),
            domain
        }
    });
}

/**
 * API Route: Chatbot Query
 * Processes user questions and returns AI-generated responses based on database data
 */
export async function POST(request) {
    try {
        const { message, conversationHistory = [] } = await request.json();

        if (!message || typeof message !== 'string') {
            return Response.json(
                { success: false, error: 'Message is required' },
                { status: 400 }
            );
        }
        if (message.length > 2000) {
            void notifySecurityEvent('chatbot_oversized_prompt', {
                ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
                length: message.length
            });
            return Response.json({ success: false, error: 'Message is too long' }, { status: 413 });
        }
        if (/\b(select|union|insert|update|delete|drop|alter|information_schema|sleep|benchmark)\b/i.test(message)) {
            void notifySecurityEvent('chatbot_sql_probe_blocked', {
                ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
                sample: message.slice(0, 200)
            });
            return Response.json({ success: false, error: 'Unsupported request' }, { status: 400 });
        }

        const allowedKnowledgeDomain = detectAllowedKnowledgeDomain(message);

        if (isRouteAdviceQuestion(message)) {
            const advice = await getRouteAdvice({ message });

            return Response.json({
                success: true,
                data: {
                    answer: advice.success ? advice.answer : advice.message,
                    sql: null,
                    results: advice.success ? advice.routes : null,
                    routeAdvice: advice.success ? advice : null,
                    resultCount: advice.success ? advice.routes.length : 0,
                    source: 'route_advice',
                    source_type: 'calculated',
                    source_label: 'ผลคำนวณจากข้อมูล EOC และผู้ให้บริการเส้นทางภายนอก',
                    generated_at: new Date().toISOString()
                }
            });
        }

        const deterministicDataResponse = await createDeterministicDataResponse({ message });
        if (deterministicDataResponse) {
            return deterministicDataResponse;
        }

        // Database access is deliberately limited to the deterministic query
        // templates above. Free-form AI-generated SQL must never be executed.
        if (allowedKnowledgeDomain) {
            if (!process.env.GEMINI_API_KEY) {
                return createAssistantUnavailableResponse({
                    domain: allowedKnowledgeDomain,
                    reason: 'ai_not_configured'
                });
            }
            const knowledgeModel = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
            });
            return createKnowledgeResponse({
                model: knowledgeModel,
                message,
                conversationHistory,
                domain: allowedKnowledgeDomain
            });
        }

        return Response.json({
            success: true,
            data: {
                answer: buildScopeAnswer(),
                sql: null,
                results: null,
                resultCount: 0,
                source: 'out_of_scope'
            }
        });

        // Check if API key is configured
        if (!process.env.GEMINI_API_KEY) {
            if (allowedKnowledgeDomain) {
                return createAssistantUnavailableResponse({
                    domain: allowedKnowledgeDomain,
                    reason: 'ai_not_configured'
                });
            }

            return Response.json({
                success: true,
                data: {
                    answer: buildScopeAnswer(),
                    sql: null,
                    results: null,
                    resultCount: 0,
                    source: 'out_of_scope'
                }
            });
        }

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2048,
            }
        });

        // Step 1: Get database schema directly from database
        let schema = {};
        let relationships = [];

        try {
            // Get all tables in the database
            const tables = await query(`
                SELECT TABLE_NAME, TABLE_COMMENT
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_TYPE = 'BASE TABLE'
                ORDER BY TABLE_NAME
            `);

            // For each table, get column information
            for (const table of tables) {
                const tableName = table.TABLE_NAME;

                const columns = await query(`
                    SELECT 
                        COLUMN_NAME,
                        DATA_TYPE,
                        COLUMN_TYPE,
                        IS_NULLABLE,
                        COLUMN_KEY,
                        COLUMN_COMMENT
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = ?
                    ORDER BY ORDINAL_POSITION
                `, [tableName]);

                schema[tableName] = {
                    comment: table.TABLE_COMMENT || '',
                    columns: columns.map(col => ({
                        name: col.COLUMN_NAME,
                        type: col.DATA_TYPE,
                        fullType: col.COLUMN_TYPE,
                        nullable: col.IS_NULLABLE === 'YES',
                        key: col.COLUMN_KEY,
                        comment: col.COLUMN_COMMENT || ''
                    }))
                };
            }

            // Get foreign key relationships
            const foreignKeys = await query(`
                SELECT 
                    TABLE_NAME,
                    COLUMN_NAME,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                AND REFERENCED_TABLE_NAME IS NOT NULL
            `);

            relationships = foreignKeys.map(fk => ({
                from: `${fk.TABLE_NAME}.${fk.COLUMN_NAME}`,
                to: `${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`
            }));

        } catch (schemaError) {
            console.error('Error fetching database schema:', schemaError);

            if (allowedKnowledgeDomain) {
                return createKnowledgeResponse({
                    model,
                    message,
                    conversationHistory,
                    domain: allowedKnowledgeDomain
                });
            }

            return Response.json({
                success: false,
                error: 'Failed to fetch database schema',
                message: 'ไม่สามารถดึงข้อมูล schema จาก database ได้'
            }, { status: 500 });
        }

        const safeSchema = filterSchemaForPdpa(schema);

        // Step 2: Generate SQL query using Gemini
        const sqlPrompt = `คุณเป็น SQL Expert สำหรับระบบ EOC (Satun Provincial Emergency Operations Center (Satun Geo-EOC)) จังหวัดสตูล

DATABASE SCHEMA (PDPA SAFE VIEW):
${JSON.stringify(safeSchema, null, 2)}

RELATIONSHIPS:
${JSON.stringify(relationships, null, 2)}

USER QUESTION: ${message}

INSTRUCTIONS:
1. วิเคราะห์คำถามของผู้ใช้
2. สร้าง SQL query ที่เหมาะสม (เฉพาะ SELECT เท่านั้น)
3. ตอบกลับในรูปแบบ JSON เท่านั้น:
   {
     "sql": "SELECT ... FROM ...",
     "explanation": "คำอธิบายว่าทำอะไร"
   }

RULES:
- ใช้เฉพาะ SELECT query เท่านั้น (ห้าม INSERT, UPDATE, DELETE, DROP)
- ถ้าคำถามไม่เกี่ยวกับข้อมูลในระบบ ให้ตอบ { "sql": null, "explanation": "คำถามนี้ไม่เกี่ยวข้องกับข้อมูลในระบบ EOC" }
- ใช้ LIMIT เพื่อจำกัดผลลัพธ์ (ไม่เกิน 100 rows)
- ตรวจสอบว่า table และ column ที่ใช้มีอยู่จริงใน schema
- ห้ามใช้หรือเปิดเผยข้อมูลที่เข้าข่าย PDPA เช่น ชื่อบุคคล, เลขบัตร, เบอร์โทร, อีเมล, ที่อยู่ละเอียด หรือพิกัดบ้าน/ตำแหน่งส่วนบุคคล
- อนุญาตให้ใช้ latitude/longitude ของเหตุการณ์ ถนน จุดบริการ หรือพื้นที่สาธารณะ เพื่อวิเคราะห์สถานการณ์และเส้นทาง
- ถ้าผู้ใช้ถามข้อมูลส่วนบุคคล ให้ตอบรวมเชิงสถิติเท่านั้น

ตอบกลับเป็น JSON เท่านั้น:`;

        let sqlResponse;
        try {
            const sqlResult = await model.generateContent(sqlPrompt);
            sqlResponse = sqlResult.response.text();
        } catch (sqlGenerationError) {
            console.error('Failed to generate SQL response:', sqlGenerationError);

            if (allowedKnowledgeDomain) {
                return createKnowledgeResponse({
                    model,
                    message,
                    conversationHistory,
                    domain: allowedKnowledgeDomain
                });
            }

            throw sqlGenerationError;
        }

        // Parse JSON response
        let sqlData;
        try {
            // Remove markdown code blocks if present
            const cleanedResponse = sqlResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            sqlData = JSON.parse(cleanedResponse);
        } catch (parseError) {
            console.error('Failed to parse SQL response:', sqlResponse);

            if (allowedKnowledgeDomain) {
                return createKnowledgeResponse({
                    model,
                    message,
                    conversationHistory,
                    domain: allowedKnowledgeDomain
                });
            }

            throw new Error('AI ไม่สามารถสร้าง SQL query ได้');
        }

        // If no SQL query (question not relevant)
        if (!sqlData.sql) {
            if (allowedKnowledgeDomain) {
                return createKnowledgeResponse({
                    model,
                    message,
                    conversationHistory,
                    domain: allowedKnowledgeDomain
                });
            }

            return Response.json({
                success: true,
                data: {
                    answer: buildScopeAnswer(),
                    sql: null,
                    results: null,
                    resultCount: 0,
                    source: 'out_of_scope'
                }
            });
        }

        // Validate SQL (basic security check)
        const sqlLower = sqlData.sql.toLowerCase();
        const dangerousKeywords = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 'exec', 'execute'];

        if (dangerousKeywords.some(keyword => sqlLower.includes(keyword))) {
            return Response.json({
                success: false,
                error: 'Invalid SQL query detected',
                message: 'ตรวจพบคำสั่ง SQL ที่ไม่อนุญาต'
            }, { status: 400 });
        }

        if (containsSensitiveSql(sqlData.sql)) {
            return Response.json({
                success: false,
                error: 'PDPA restricted query',
                message: 'คำขอนี้มีข้อมูลส่วนบุคคลตาม PDPA ระบบจึงไม่อนุญาต กรุณาถามเป็นข้อมูลสถิติภาพรวม'
            }, { status: 403 });
        }

        // Step 3: Execute SQL query
        let queryResults;
        try {
            // Defense in depth: free-form SQL execution is permanently disabled.
            // Database answers must be added as deterministic templates above.
            throw new Error('Free-form SQL execution is disabled');
        } catch (dbError) {
            console.error('Database query error:', dbError);
            return Response.json({
                success: false,
                error: 'Database query failed',
                message: 'ไม่สามารถดึงข้อมูลจาก database ได้',
                sql: sqlData.sql
            }, { status: 500 });
        }

        const safeResults = redactSensitiveFields(queryResults);

        // Step 4: Generate natural language response using Gemini
        const answerPrompt = `คุณเป็นผู้ช่วย AI สำหรับระบบ EOC (Satun Geo-EOC Intelligence Platform) จังหวัดสตูล

USER QUESTION: ${message}

SQL QUERY ที่ใช้: ${sqlData.sql}

QUERY RESULTS:
${JSON.stringify(safeResults, null, 2)}

INSTRUCTIONS:
1. วิเคราะห์ผลลัพธ์จาก database
2. สรุปข้อมูลเป็นภาษาไทยที่เข้าใจง่าย
3. ถ้ามีตัวเลข ให้แสดงอย่างชัดเจน
4. ถ้าไม่มีข้อมูล ให้บอกว่าไม่พบข้อมูล
5. ตอบแบบสั้นกระชับ เป็นมิตร

ตอบกลับเป็นภาษาไทยเท่านั้น:`;

        let answer;
        try {
            const answerResult = await model.generateContent(answerPrompt);
            answer = answerResult.response.text().trim();
        } catch (answerGenerationError) {
            console.error('Failed to generate natural language answer:', answerGenerationError);
            answer = createBasicDatabaseAnswer({ message, results: safeResults });
        }

        return Response.json({
            success: true,
            data: {
                answer,
                sql: sqlData.sql,
                results: safeResults,
                resultCount: safeResults.length,
                source: 'database'
            }
        });

    } catch (error) {
        console.error('Chatbot query error:', error);
        return Response.json(
            {
                success: false,
                error: 'Chatbot query failed',
                message: 'ไม่สามารถตอบคำถามได้ในขณะนี้ กรุณาลองใหม่'
            },
            { status: 500 }
        );
    }
}
