import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '@/lib/db';

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
    /lat/i,
    /lon/i,
    /latitude/i,
    /longitude/i,
    /exact_location/i
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
            return Response.json({
                success: false,
                error: 'Failed to fetch database schema',
                message: 'ไม่สามารถดึงข้อมูล schema จาก database ได้'
            }, { status: 500 });
        }

        const safeSchema = filterSchemaForPdpa(schema);

        // Step 2: Generate SQL query using Gemini
        // Using gemini-2.5-flash - fast and cost-efficient model available in 2026
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.1, // Low temperature for more consistent SQL generation
                maxOutputTokens: 2048,
            }
        });

        const sqlPrompt = `คุณเป็น SQL Expert สำหรับระบบ EOC (Satun Geo-EOC Intelligence Platform) จังหวัดสตูล

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
- ห้ามใช้หรือเปิดเผยข้อมูลที่เข้าข่าย PDPA เช่น ชื่อบุคคล, เลขบัตร, เบอร์โทร, อีเมล, ที่อยู่, พิกัดระบุตัวบุคคล
- ถ้าผู้ใช้ถามข้อมูลส่วนบุคคล ให้ตอบรวมเชิงสถิติเท่านั้น

ตอบกลับเป็น JSON เท่านั้น:`;

        const sqlResult = await model.generateContent(sqlPrompt);
        const sqlResponse = sqlResult.response.text();

        // Parse JSON response
        let sqlData;
        try {
            // Remove markdown code blocks if present
            const cleanedResponse = sqlResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            sqlData = JSON.parse(cleanedResponse);
        } catch (parseError) {
            console.error('Failed to parse SQL response:', sqlResponse);
            throw new Error('AI ไม่สามารถสร้าง SQL query ได้');
        }

        // If no SQL query (question not relevant)
        if (!sqlData.sql) {
            return Response.json({
                success: true,
                data: {
                    answer: sqlData.explanation || 'ขออภัยครับ คำถามนี้ไม่เกี่ยวข้องกับข้อมูลในระบบ EOC',
                    sql: null,
                    results: null
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
                resultCount: safeResults.length
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
