import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '@/lib/db';
import { getRouteAdvice, isRouteAdviceQuestion } from '@/lib/routeAdvice';
import { notifySecurityEvent } from '@/lib/telegram';
import { requireAuth } from '@/lib/auth';
import { getClientIp } from '@/lib/clientIp';
import { consumeRateLimit, tooManyRequestsResponse } from '@/lib/rateLimit';
import { actionsForTopic, answerResolved, buildSnapshot, detectLiveIntent, isAdviceQuestion, resolveQuestion } from '@/lib/assistantLive';
import { knowledgeAnswer, knowledgeFacts, matchKnowledge } from '@/lib/assistantKnowledge';
import { loadAssistantData } from '@/lib/assistantData';

// คำถามต่อเนื่องที่แนะนำหลังคำตอบแต่ละแบบ (ชวนถามเรื่องที่เกี่ยวข้องกันต่อ)
const FOLLOW_UPS = {
    water: ['ฝนตอนนี้เป็นยังไง', 'พรุ่งนี้ฝนจะตกหนักไหม', 'บ้านฉันเสี่ยงน้ำท่วมไหม'],
    rain: ['ระดับน้ำในคลองตอนนี้', 'พรุ่งนี้ฝนจะตกหนักไหม', 'มีประกาศเตือนไหม'],
    risk: ['ระดับน้ำในคลองตอนนี้', 'พรุ่งนี้ฝนจะตกหนักไหม', 'ศูนย์พักพิงที่เปิดอยู่'],
    forecast: ['ระดับน้ำในคลองตอนนี้', 'น้ำท่วมควรเตรียมตัวอย่างไร', 'มีประกาศเตือนไหม'],
    warning: ['ระดับน้ำในคลองตอนนี้', 'ศูนย์พักพิงที่เปิดอยู่', 'น้ำท่วมควรเตรียมตัวอย่างไร'],
    shelter: ['ควรเตรียมของอะไรไปศูนย์พักพิง', 'โรงพยาบาลใกล้ฉันเปิดไหม', 'ระดับน้ำในคลองตอนนี้'],
    health: ['ศูนย์พักพิงที่เปิดอยู่', 'น้ำกัดเท้าดูแลยังไง', 'มีประกาศเตือนไหม'],
    track: ['ขอความช่วยเหลือต้องทำอย่างไร', 'ศูนย์พักพิงที่เปิดอยู่'],
    help: ['ติดตามคำขอได้อย่างไร', 'ศูนย์พักพิงที่เปิดอยู่'],
    sea: ['ระดับน้ำในคลองตอนนี้', 'น้ำทะเลหนุนกับฝนหนักพร้อมกันอันตรายไหม', 'พรุ่งนี้ฝนจะตกหนักไหม'],
    event: ['อำเภอไหนมีผู้ป่วยมากที่สุด', 'ควรป้องกันตัวอย่างไร', 'มีประกาศเตือนไหม'],
    hotline: ['ขอความช่วยเหลือต้องทำอย่างไร', 'ศูนย์พักพิงที่เปิดอยู่'],
    general: ['ระดับน้ำในคลองตอนนี้', 'วันนี้อำเภอไหนเสี่ยงบ้าง', 'พรุ่งนี้ฝนจะตกหนักไหม']
};

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
    /น้ำทะเล|น้ำขึ้นน้ำลง/i,
    /อพยพ|ถุงยังชีพ|ของใช้จำเป็น|เตรียมของ/i,
    /ไฟฟ้าดูด|ไฟดูด|ไฟฟ้ารั่ว|ตัดไฟ/i,
    /งู|ตะขาบ|สัตว์มีพิษ/i,
    /น้ำกัดเท้า|น้ำดื่ม|น้ำสะอาด/i,
    /ดินถล่ม|ดินโคลน|ตลิ่งพัง/i,
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
    /ฝุ่น|pm\s*2\.?5/i,
    /ยุง|ผื่น|ตาแดง|ท้องร่วง|ตัวร้อน/i,
    /อุบัติเหตุ|เมาแล้วขับ/i,
    // สุขภาพทั่วไป อาการ การดูแลรักษาเบื้องต้น ปฐมพยาบาล
    /ปวด|อาการ|รักษา|ป่วย|เจ็บ|บวม|แพ้|คัน|แผล|ปฐมพยาบาล|พบแพทย์|หาหมอ|ไปหมอ/i,
    /กินยา|ใช้ยา|ยา(อะไร|ตัวไหน|แก้|ลดไข้|ฆ่าเชื้อ|ประจำตัว|หมด)/i,
    /ตั้งครรภ์|คนท้อง|เบาหวาน|ความดัน|ฟอกไต|ติดเตียง|ผู้สูงอายุ|ทารก|เด็กเล็ก/i,
    /เครียด|นอนไม่หลับ|สุขภาพจิต|จมน้ำ|cpr|ปั๊มหัวใจ|หมดสติ|เป็นลม/i,
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
    /ฟ้าผ่า|คลื่นสูง|คลื่นลม|อากาศร้อน/i,
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

function detectAllowedKnowledgeDomain(message) {
    const text = String(message || '');
    // หัวข้อที่ระบบมีข้อมูลจริง (ศูนย์พักพิง สถานพยาบาล ติดตามคำขอ ฯลฯ) อยู่ในขอบเขตเสมอ
    if (detectLiveIntent(text)) return 'flood_and_weather';
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
    if (domain === 'disease') return 'โรค สุขภาพ อาการ และการดูแลรักษาเบื้องต้น';
    if (domain === 'weather') return 'สภาพฟ้าฝนและอากาศ';
    if (domain === 'flood_and_weather') return 'อุทกภัยน้ำท่วม สภาพฟ้าฝน และบริการช่วยเหลือในจังหวัดสตูล';
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
    return 'ขออภัยครับ เรื่องนี้อยู่นอกสิ่งที่น้องสจ๊วต ตอบได้\nผมช่วยได้เรื่อง น้ำท่วมและการเตรียมตัว ฝนและพยากรณ์ ระดับน้ำในคลอง ความเสี่ยงรายอำเภอ ศูนย์พักพิง สถานพยาบาล โรคที่มากับน้ำท่วม อาการและการดูแลตัวเองเบื้องต้น ปฐมพยาบาล การขอความช่วยเหลือ และการติดตามคำขอ ลองเลือกคำถามด้านล่างได้เลยครับ';
}

function buildAssistantUnavailableAnswer() {
    return 'ตอนนี้ส่วนที่ใช้ AI ตอบคำถามทั่วไปขัดข้องชั่วคราวครับ ลองถามใหม่อีกครั้งในอีกสักครู่\nระหว่างนี้ผมยังตอบเรื่องสถานการณ์จากข้อมูลจริงได้ทันที เช่น ระดับน้ำในคลอง ฝนตอนนี้ พยากรณ์ฝนหนัก ความเสี่ยงรายอำเภอ และศูนย์พักพิง';
}

function createAssistantUnavailableResponse({ domain = null, reason = 'ai_unavailable' } = {}) {
    return Response.json({
        success: true,
        data: {
            answer: buildAssistantUnavailableAnswer(),
            suggestions: ['ระดับน้ำในคลองตอนนี้', 'ฝนตอนนี้เป็นยังไง', 'วันนี้อำเภอไหนเสี่ยงบ้าง'],
            sql: null,
            results: null,
            resultCount: 0,
            source: reason,
            domain
        }
    });
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
                answer: `พบ EOC โรคไข้เลือดออกเหตุการณ์ ${session.session_number || session.id} แต่ยังไม่มีรายงานผู้ป่วยในระบบครับ`,
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
        `อ้างอิงข้อมูล EOC โรคไข้เลือดออกเหตุการณ์ ${session.session_number || session.id}${openedDate ? ` เปิดเมื่อ ${openedDate}` : ''} รวมทั้งหมด ${formatThaiNumber(totalPatients)} ราย`,
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
            `EOC โรคไข้เลือดออกเหตุการณ์ ${session.session_number || session.id} มีผู้ป่วยรวม ${formatThaiNumber(totalPatients)} ราย จาก ${formatThaiNumber(rankedDistricts.length)} อำเภอครับ`,
            firstReport && latestReport ? `ช่วงข้อมูลรายงาน ${formatThaiDate(firstReport)} - ${formatThaiDate(latestReport)}` : null,
            `อำเภอที่มีผู้ป่วยสูงสุด:\n${topList}`
        ].filter(Boolean).join('\n')
        : `พบ EOC โรคไข้เลือดออกเหตุการณ์ ${session.session_number || session.id} แต่ยังไม่มีรายงานผู้ป่วยในระบบครับ`;

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
            `ข้อมูลน้ำท่วมล่าสุดวันที่ ${latestDateText} จาก EOC เหตุการณ์ ${session.session_number || session.id} (${sessionStatusText}) พบพื้นที่ได้รับผลกระทบ ${formatThaiNumber(totalVillages)} หมู่บ้าน ใน ${formatThaiNumber(normalizedDistricts.length)} อำเภอ${totalPeople ? ` รวมประชาชน ${formatThaiNumber(totalPeople)} คน` : ''}ครับ`,
            `สรุปรายอำเภอ:\n${districtList}`,
            villageList ? `พื้นที่ตัวอย่างที่มีระดับน้ำท่วม:\n${villageList}` : null
        ].filter(Boolean).join('\n')
        : `ข้อมูลน้ำท่วมล่าสุดวันที่ ${latestDateText} จาก EOC เหตุการณ์ ${session.session_number || session.id} (${sessionStatusText}) ไม่พบพื้นที่ที่มีระดับน้ำท่วมในวันดังกล่าวครับ`;

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

const SYSTEM_INSTRUCTION = `คุณคือ "น้องสจ๊วต" ของศูนย์ปฏิบัติการภาวะฉุกเฉิน จังหวัดสตูล (Satun Geo-EOC) ช่วยประชาชนและเจ้าหน้าที่เรื่องน้ำท่วม ฝนและอากาศ น้ำทะเลหนุน โรคและการระบาด อุบัติเหตุช่วงเทศกาล และบริการช่วยเหลือในจังหวัดสตูล
หลักการ:
- ตัวเลขและสถานการณ์ "ตอนนี้" ใช้ได้เฉพาะจาก "ข้อมูลสถานการณ์จริงจากระบบ" และ "ข้อเท็จจริงที่เกี่ยวกับคำถาม" ที่ให้ไว้ ห้ามแต่งตัวเลข สถานที่ เบอร์โทร หรือเวลาเพิ่ม ถ้าไม่มีข้อมูลให้บอกตรง ๆ
- คิดต่อจากข้อมูลให้ผู้ใช้: เชื่อมฝน + ระดับน้ำในคลอง + แนวโน้มขึ้น/ลง + น้ำทะเลหนุน + พยากรณ์ เป็นข้อสรุปว่าควรทำอะไร ไม่ใช่แค่ทวนตัวเลข
- เรื่องสุขภาพ: ตอบได้กว้าง ทั้งโรคที่มากับน้ำท่วม อาการ การดูแลตัวเองเบื้องต้น ปฐมพยาบาล การป้องกัน และ "อาการแบบไหนต้องพบแพทย์" ตามแนวทางกระทรวงสาธารณสุข
  ไม่วินิจฉัยเฉพาะราย ไม่ระบุชื่อยาอันตรายหรือขนาดยา (ให้ใช้ตามฉลากหรือปรึกษาเภสัชกร/แพทย์) ปิดท้ายเรื่องสุขภาพด้วยสัญญาณอันตรายที่ต้องไปโรงพยาบาล อาการรุนแรงให้โทร 1669 ทันที
- ถ้ามี "ความรู้มาตรฐานของศูนย์ฯ" ในข้อเท็จจริง ให้ยึดเป็นหลัก ห้ามขัดแย้ง ปรับให้ตรงกับคำถามและสถานการณ์ของผู้ใช้ได้
- เบอร์ที่ใช้ได้: 1669 เจ็บป่วยฉุกเฉิน, 1784 ปภ., 1422 กรมควบคุมโรค, 1323 สุขภาพจิต, 1367 ศูนย์พิษวิทยา (ห้ามแต่งเบอร์อื่น)
- อันตรายถึงชีวิต (ติดน้ำ ไฟฟ้าดูด หมดสติ) ขึ้นต้นด้วยสิ่งที่ต้องทำทันทีและเบอร์ฉุกเฉิน
- นอกขอบเขต (การเมือง บันเทิง เขียนโค้ด ฯลฯ) ปฏิเสธสั้น ๆ แล้วชวนถามเรื่องที่ช่วยได้
- ไม่ขอและไม่เปิดเผยข้อมูลส่วนบุคคล
รูปแบบ:
- ภาษาไทย สุภาพ เป็นกันเอง ลงท้าย "ครับ" ไม่ทักทาย ไม่แนะนำตัว เริ่มที่คำตอบเลย
- ประโยคแรกตอบคำถามตรง ๆ แล้วตามด้วยเหตุผลหรือสิ่งที่ควรทำเป็นข้อ ขึ้นต้นข้อด้วย "• "
- ข้อความธรรมดา ไม่ใช้ Markdown ไม่ใช้ตาราง ไม่เกิน 8 บรรทัด เว้นแต่ผู้ใช้ขอรายละเอียด
- อ้างเวลาของข้อมูลเมื่อพูดถึงตัวเลขปัจจุบัน`;

async function generateKnowledgeAnswer({ model, message, conversationHistory, domain, snapshot, facts }) {
    const prompt = `ข้อมูลสถานการณ์จริงจากระบบ:
${snapshot || 'ไม่มีข้อมูลสถานการณ์ในขณะนี้'}
${facts ? `\nข้อเท็จจริงที่เกี่ยวกับคำถามนี้ (จากระบบ ใช้เป็นหลักในการตอบ):\n${facts}\n` : ''}
หัวข้อที่เกี่ยวข้อง: ${getKnowledgeDomainLabel(domain)}

บทสนทนาก่อนหน้า (ใช้ตีความคำถามต่อเนื่อง เช่น "แล้วละงูล่ะ"):
${buildConversationContext(conversationHistory)}

คำถามล่าสุด:
${message}`;

    const result = await model.generateContent(prompt);
    // หน้าจอแชทแสดงข้อความธรรมดา: ตัดเครื่องหมาย Markdown ที่หลุดมา
    return result.response.text().trim()
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/^#+\s*/gm, '')
        .replace(/^\s*[-*]\s+/gm, '• ');
}

function liveResponse(live, extra = {}) {
    return Response.json({
        success: true,
        data: {
            answer: live.answer,
            sql: null,
            results: null,
            resultCount: 0,
            source: `live_${live.intent}`,
            source_type: 'database',
            source_label: live.sourceLabel,
            generated_at: new Date().toISOString(),
            actions: live.actions || [],
            suggestions: FOLLOW_UPS[live.intent] || FOLLOW_UPS.general,
            district: live.district,
            ...extra
        }
    });
}

/** คำตอบจากคลังความรู้ของศูนย์ฯ (ไม่ใช้ AI) */
function knowledgeResponse(kb, extra = {}) {
    return Response.json({
        success: true,
        data: {
            answer: kb.answer,
            sql: null,
            results: null,
            resultCount: 0,
            source: `knowledge_${kb.topicId}`,
            source_type: 'knowledge',
            source_label: 'คำแนะนำเบื้องต้นด้านสาธารณสุขและการรับมือภัย (คลังความรู้ของศูนย์ฯ)',
            generated_at: new Date().toISOString(),
            actions: kb.actions || [],
            suggestions: kb.suggestions || FOLLOW_UPS.general,
            ...extra
        }
    });
}

async function createKnowledgeResponse({ model, message, conversationHistory, domain, snapshot, live = null, kb = null, topics = [] }) {
    let answer;
    const facts = [
        live?.answer || null,
        topics.length ? `ความรู้มาตรฐานของศูนย์ฯ:\n${knowledgeFacts(topics)}` : null
    ].filter(Boolean).join('\n\n');
    try {
        answer = await generateKnowledgeAnswer({
            model,
            message,
            conversationHistory,
            domain,
            snapshot,
            facts: facts || null
        });
    } catch (knowledgeError) {
        console.error('Failed to generate knowledge response:', knowledgeError?.message || knowledgeError);
        // AI ขัดข้อง: ตอบจากคลังความรู้ หรือข้อมูลจริงที่เกี่ยวข้อง แทนการบอกว่าตอบไม่ได้
        if (kb) return knowledgeResponse(kb, { source_label: 'คำแนะนำเบื้องต้นจากคลังความรู้ของศูนย์ฯ (AI ไม่พร้อม)' });
        if (live) return liveResponse(live, { source_label: `${live.sourceLabel} (AI ไม่พร้อม แสดงข้อมูลจากระบบแทน)` });
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
            source_type: snapshot ? 'ai_grounded' : 'general_guidance',
            source_label: snapshot ? 'AI ตอบจากข้อมูลสถานการณ์ของระบบ ร่วมกับความรู้ทั่วไป' : 'คำแนะนำทั่วไปจาก AI ไม่ใช่ข้อมูลสถานการณ์จาก EOC',
            generated_at: new Date().toISOString(),
            domain,
            actions: live?.actions?.length ? live.actions : kb?.actions?.length ? kb.actions : actionsForTopic(message),
            suggestions: kb?.suggestions || FOLLOW_UPS[live?.intent || detectLiveIntent(message) || 'general']
        }
    });
}

/**
 * API Route: Chatbot Query
 * Processes user questions and returns AI-generated responses based on database data
 */
export async function POST(request) {
    try {
        const { message, conversationHistory = [], analyticsContext = false, userDistrict = null } = await request.json();
        const clientIp = getClientIp(request);
        if (analyticsContext) {
            const auth = await requireAuth(request, ['admin', 'commander', 'staff']);
            if (!auth.success) return auth.response;
            const limit = await consumeRateLimit('chatbotAnalytics', `user:${auth.user.id}`);
            if (!limit.allowed) return tooManyRequestsResponse(limit, 'ส่งคำถามถี่เกินไป กรุณารอสักครู่');
        } else {
            // แชตบอตสาธารณะเรียก Gemini ซึ่งมีค่าใช้จ่ายจริง จึงจำกัดจำนวนครั้งต่อ IP
            const limit = await consumeRateLimit('chatbotPublic', clientIp);
            if (!limit.allowed) return tooManyRequestsResponse(limit, 'ส่งคำถามถี่เกินไป กรุณารอสักครู่');
        }

        if (!message || typeof message !== 'string') {
            return Response.json(
                { success: false, error: 'Message is required' },
                { status: 400 }
            );
        }
        if (message.length > 2000) {
            void notifySecurityEvent('chatbot_oversized_prompt', {
                ip: clientIp,
                length: message.length
            });
            return Response.json({ success: false, error: 'Message is too long' }, { status: 413 });
        }
        if (/\b(select|union|insert|update|delete|drop|alter|information_schema|sleep|benchmark)\b/i.test(message)) {
            void notifySecurityEvent('chatbot_sql_probe_blocked', {
                ip: clientIp,
                sample: message.slice(0, 200)
            });
            return Response.json({ success: false, error: 'Unsupported request' }, { status: 400 });
        }

        // ตีความคำถามโดยดูบทสนทนาก่อนหน้า (เช่น "แล้วละงูล่ะ" ต่อจาก "ระดับน้ำในคลองตอนนี้")
        const resolved = resolveQuestion(message, conversationHistory, userDistrict);
        const previousUserText = [...(Array.isArray(conversationHistory) ? conversationHistory : [])].reverse().find((item) => item?.role === 'user')?.content || '';
        const allowedKnowledgeDomain = detectAllowedKnowledgeDomain(message)
            || (resolved.intent ? 'flood_and_weather' : null)
            || (message.length <= 60 ? detectAllowedKnowledgeDomain(previousUserText) : null);

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

        // คำถามสถานการณ์ "ตอนนี้" (น้ำ ฝน ความเสี่ยง ศูนย์พักพิง ฯลฯ) ตอบจากข้อมูลจริงทันที ไม่ต้องรอ AI
        // ยกเว้นคำถามขอคำแนะนำ ("ควรอพยพไหม" "เดินทางได้ไหม") ให้ AI คิดต่อจากข้อมูลจริงชุดเดียวกัน
        // ความรู้ด้านสุขภาพ/การรับมือภัย: เรื่องเร่งด่วนถึงชีวิต (ไฟดูด จมน้ำ งูกัด) ตอบจากคลังความรู้ทันที ไม่รอ AI
        const topics = analyticsContext ? [] : matchKnowledge(message);
        const kb = knowledgeAnswer(topics);
        if (kb?.urgent) return knowledgeResponse(kb);

        const assistantData = analyticsContext ? null : await loadAssistantData().catch(() => null);
        const district = resolved.district;
        const live = assistantData ? answerResolved(resolved, assistantData) : null;
        const advice = isAdviceQuestion(message);
        if (live && (!advice || !process.env.GEMINI_API_KEY)) {
            return liveResponse(live, resolved.followUp ? { follow_up: true } : {});
        }
        // ไม่มี AI: ตอบจากคลังความรู้ได้เลย
        if (kb && !process.env.GEMINI_API_KEY) return knowledgeResponse(kb);
        const knowledgeDomain = allowedKnowledgeDomain || (kb ? (kb.kind === 'flood' ? 'flood' : 'disease') : null);

        // Database access is deliberately limited to the deterministic query
        // templates above. Free-form AI-generated SQL must never be executed.
        if (knowledgeDomain) {
            if (!process.env.GEMINI_API_KEY) {
                return createAssistantUnavailableResponse({
                    domain: knowledgeDomain,
                    reason: 'ai_not_configured'
                });
            }
            const knowledgeModel = genAI.getGenerativeModel({
                model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
                systemInstruction: SYSTEM_INSTRUCTION,
                generationConfig: { temperature: 0.25, maxOutputTokens: 2048 }
            });
            return createKnowledgeResponse({
                model: knowledgeModel,
                message,
                conversationHistory,
                domain: knowledgeDomain,
                snapshot: assistantData ? buildSnapshot(assistantData, { district }) : null,
                live,
                kb,
                topics
            });
        }

        return Response.json({
            success: true,
            data: {
                answer: buildScopeAnswer(),
                sql: null,
                results: null,
                resultCount: 0,
                source: 'out_of_scope',
                suggestions: FOLLOW_UPS.general
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
