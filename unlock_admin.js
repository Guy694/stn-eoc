
const mysql = require('mysql2/promise');

async function main() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '123456',
        database: 'stneoc'
    });

    try {
        await pool.execute('UPDATE officer SET failed_login_attempts = 0, account_locked_until = NULL WHERE username = ?', ['admin']);
        console.log('Unlocked admin user');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        pool.end();
    }
}

main();
