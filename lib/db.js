import mysql from 'mysql2/promise';

// ใช้ connection pool เดียวทั้งแอป
// - เก็บไว้ใน globalThis เพื่อไม่ให้ Next.js dev (HMR) สร้าง pool ซ้ำทุกครั้งที่แก้ไฟล์
// - ห้ามสร้าง mysql.createPool() เองใน route อื่น ให้ import getPool/query/transaction จากไฟล์นี้แทน
const POOL_KEY = Symbol.for('stn-eoc.mysql-pool');
let warnedAboutRoot = false;

export function getDbConfig(env = process.env) {
    const user = env.DB_USER || 'root';
    if (env.NODE_ENV === 'production' && user === 'root' && !warnedAboutRoot) {
        warnedAboutRoot = true;
        console.warn('[db] DB_USER เป็น root ใน production — ควรสร้าง user เฉพาะแอปที่มีสิทธิ์เท่าที่จำเป็น');
    }

    return {
        host: env.DB_HOST || 'localhost',
        user,
        password: env.DB_PASSWORD ?? '',
        database: env.DB_NAME || 'stneoc',
        port: Number.parseInt(env.DB_PORT || '3306', 10),
        waitForConnections: true,
        connectionLimit: Number.parseInt(env.DB_POOL_LIMIT || '10', 10),
        queueLimit: 0,
    };
}

export function getPool() {
    if (!globalThis[POOL_KEY]) {
        globalThis[POOL_KEY] = mysql.createPool(getDbConfig());
    }
    return globalThis[POOL_KEY];
}

// คงไว้เพื่อความเข้ากันได้กับโค้ดเดิมที่เรียก `await getConnection()` แล้วได้ pool กลับมา
export async function getConnection() {
    return getPool();
}

export async function query(sql, params) {
    try {
        const [results] = await getPool().execute(sql, params);
        return results;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

export async function transaction(callback) {
    const connection = await getPool().getConnection();
    try {
        await connection.beginTransaction();
        const execute = async (sql, params) => {
            const [results] = await connection.execute(sql, params);
            return results;
        };
        const result = await callback(execute, connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

const db = { getConnection, getPool, query, transaction };

export default db;
