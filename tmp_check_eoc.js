const mysql = require('mysql2/promise');

async function checkEOC() {
    const connection = await mysql.createConnection({
        host: 'localhost', user: 'root', password: process.env.DB_PASSWORD || '123456', database: 'stneoc'
    });
    try {
        const [rows] = await connection.execute('DESCRIBE eoc_sessions;');
        console.table(rows.map(x => x.Field));
    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}
checkEOC();
