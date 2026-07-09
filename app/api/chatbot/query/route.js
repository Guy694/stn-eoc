import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '@/lib/db';
import { getRouteAdvice, isRouteAdviceQuestion } from '@/lib/routeAdvice';

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
    const answer = await generateKnowledgeAnswer({
        model,
        message,
        conversationHistory,
        domain
    });

    return Response.json({
        success: true,
        data: {
            answer,
            sql: null,
            results: null,
            resultCount: 0,
            source: 'general_knowledge',
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
                    source: 'route_advice'
                }
            });
        }

        const allowedKnowledgeDomain = detectAllowedKnowledgeDomain(message);

        // Check if API key is configured
        if (!process.env.GEMINI_API_KEY) {
            return Response.json(
                {
                    success: false,
                    error: 'Gemini API key not configured',
                    message: 'กรุณาตั้งค่า GEMINI_API_KEY ใน .env.local'
                },
                { status: 500 }
            );
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
            queryResults = await query(sqlData.sql);
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

        const answerResult = await model.generateContent(answerPrompt);
        const answer = answerResult.response.text();

        return Response.json({
            success: true,
            data: {
                answer: answer.trim(),
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
