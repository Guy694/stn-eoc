const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Simple .env parser
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const envVars = {};
        envFile.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^['"]|['"]$/g, ''); // Remove quotes if present
                if (!key.startsWith('#')) {
                    envVars[key] = value;
                }
            }
        });
        return envVars;
    } catch (e) {
        console.error('Could not read .env file', e);
        return {};
    }
}

const env = loadEnv();

async function testConnection() {
    console.log('Testing connection to:', env.DB_HOST);
    console.log('User:', env.DB_USER);
    // Don't log password

    try {
        const connection = await mysql.createConnection({
            host: env.DB_HOST,
            user: env.DB_USER,
            password: env.DB_PASSWORD,
            database: env.DB_NAME,
            port: parseInt(env.DB_PORT || '3306'),
            connectTimeout: 5000
        });
        console.log('Successfully connected to database!');
        await connection.end();
    } catch (error) {
        console.error('Connection failed!');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        if (error.code === 'ETIMEDOUT') {
            console.error('Diagnosis: The server is not responding. Check Firewall or correct IP.');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('Diagnosis: Connection refused. Is MySQL running on port 3306?');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('Diagnosis: Access denied. Check username, password, or IP allowlist.');
        } else {
            console.error('Diagnosis: Unknown error. Check network and credentials.');
        }
    }
}

testConnection();
