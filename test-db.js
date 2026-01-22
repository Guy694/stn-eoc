const mysql = require('mysql2/promise');

(async () => {
    try {
        const conn = await mysql.createConnection({
            host: '199.21.175.91',
            user: 'skyline694',
            password: '29012540',
            database: 'stneoc'
        });

        const [rows] = await conn.query('SELECT NOW() AS time');
        console.log(rows);

        await conn.end();
    } catch (err) {
        console.error('DB ERROR:', err);
    }
})();