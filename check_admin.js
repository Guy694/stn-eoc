
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function main() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '123456',
        database: 'stneoc'
    });

    try {
        const [rows] = await pool.execute('SELECT * FROM officer WHERE username = ?', ['admin']);
        if (rows.length === 0) {
            console.log('User admin NOT FOUND');
        } else {
            console.log('User admin FOUND');
            const u = rows[0];
            console.log('failed_login_attempts:', u.failed_login_attempts);
            console.log('account_locked_until:', u.account_locked_until);
            console.log('must_change_password:', u.must_change_password);

            const match = await bcrypt.compare('password123', u.password_hash);
            console.log('Password match:', match);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        pool.end();
    }
}

main();
