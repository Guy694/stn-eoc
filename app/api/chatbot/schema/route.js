import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * API Route: Get Database Schema
 * Returns database schema information for AI to generate SQL queries
 */
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        // Get all tables in the database
        const tables = await query(`
      SELECT TABLE_NAME, TABLE_COMMENT
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

        const schema = {};

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

        const relationships = foreignKeys.map(fk => ({
            from: `${fk.TABLE_NAME}.${fk.COLUMN_NAME}`,
            to: `${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`
        }));

        return Response.json({
            success: true,
            data: {
                schema,
                relationships,
                tableCount: Object.keys(schema).length
            }
        });

    } catch (error) {
        console.error('Error fetching database schema:', error);
        return Response.json(
            {
                success: false,
                error: 'Failed to fetch database schema',
                message: 'เกิดข้อผิดพลาดในการดึงโครงสร้างฐานข้อมูล'
            },
            { status: 500 }
        );
    }
}
