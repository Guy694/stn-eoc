const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function main() {
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
        console.error('Missing ADMIN_PASSWORD environment variable');
        process.exit(1);
    }

    if (password.length < 8) {
        console.error('ADMIN_PASSWORD must be at least 8 characters');
        process.exit(1);
    }

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'stneoc'
    });

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const [result] = await connection.execute(
            `UPDATE officer
             SET password_hash = ?,
                 role = 'admin',
                 is_approved = 1,
                 failed_login_attempts = 0,
                 account_locked_until = NULL,
                 must_change_password = 0,
                 updated_at = NOW()
             WHERE username = 'admin'`,
            [passwordHash]
        );

        if (result.affectedRows === 0) {
            console.error('Admin user not found');
            process.exit(1);
        }

        console.log('Development admin password reset successfully');
    } finally {
        await connection.end();
    }
}

main().catch((error) => {
    console.error('Failed to reset development admin:', error.message);
    process.exit(1);
});
