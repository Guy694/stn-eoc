const mysql = require('mysql2/promise');

async function checkColumns() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: process.env.DB_PASSWORD || '123456',
        database: 'stneoc'
    });

    try {
        const [rows] = await connection.execute('DESCRIBE temporary_service_points;');
        console.table(rows.map(r => ({ Field: r.Field, Type: r.Type })));
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await connection.end();
    }
}

checkColumns();
