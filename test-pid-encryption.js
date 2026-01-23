// Test script สำหรับทดสอบการเข้ารหัสและถอดรหัส PID
// ใช้คำสั่ง: SECRET_KEY=OKNAKANAKA node test-pid-encryption.js

const crypto = require('crypto');

// คัดลอกฟังก์ชันเข้ารหัสและถอดรหัสมาจาก callback route
function encryptPID(pid) {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey) {
        throw new Error('SECRET_KEY is not defined in environment variables');
    }

    // สร้าง key ขนาด 32 bytes จาก SECRET_KEY
    const key = crypto.createHash('sha256').update(secretKey).digest();

    // สร้าง initialization vector (IV) แบบสุ่ม
    const iv = crypto.randomBytes(16);

    // สร้าง cipher ด้วย AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // เข้ารหัสข้อมูล
    let encrypted = cipher.update(pid, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // ดึง auth tag
    const authTag = cipher.getAuthTag();

    // รวม IV + encrypted data + auth tag เข้าด้วยกัน (คั่นด้วย :)
    return iv.toString('hex') + ':' + encrypted + ':' + authTag.toString('hex');
}

function decryptPID(encryptedPID) {
    try {
        const secretKey = process.env.SECRET_KEY;
        if (!secretKey) {
            throw new Error('SECRET_KEY is not defined in environment variables');
        }

        // แยก IV, encrypted data, และ auth tag
        const parts = encryptedPID.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted PID format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const authTag = Buffer.from(parts[2], 'hex');

        // สร้าง key ขนาด 32 bytes จาก SECRET_KEY
        const key = crypto.createHash('sha256').update(secretKey).digest();

        // สร้าง decipher
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        // ถอดรหัส
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Error decrypting PID:', error);
        throw new Error('Failed to decrypt PID');
    }
}

// ========== เริ่มการทดสอบ ==========
console.log('='.repeat(60));
console.log('🧪 Testing PID Encryption/Decryption');
console.log('='.repeat(60));
console.log();

// Test Case 1: Basic Encryption/Decryption
console.log('📝 Test 1: Basic Encryption and Decryption');
console.log('-'.repeat(60));
const testPID1 = '1234567890123';
console.log('Original PID:', testPID1);

const encrypted1 = encryptPID(testPID1);
console.log('Encrypted:', encrypted1);
console.log('Encrypted Length:', encrypted1.length, 'characters');

const decrypted1 = decryptPID(encrypted1);
console.log('Decrypted:', decrypted1);

const match1 = testPID1 === decrypted1;
console.log('✓ Match:', match1 ? '✅ PASS' : '❌ FAIL');
console.log();

// Test Case 2: Multiple Encryptions Give Different Results
console.log('📝 Test 2: Same PID Encrypts Differently Each Time');
console.log('-'.repeat(60));
const testPID2 = '9876543210987';
const encrypted2a = encryptPID(testPID2);
const encrypted2b = encryptPID(testPID2);

console.log('First Encryption:', encrypted2a);
console.log('Second Encryption:', encrypted2b);
console.log('Are Different:', encrypted2a !== encrypted2b ? '✅ PASS' : '❌ FAIL');

const decrypted2a = decryptPID(encrypted2a);
const decrypted2b = decryptPID(encrypted2b);
console.log('Both Decrypt to Same:', (decrypted2a === decrypted2b && decrypted2a === testPID2) ? '✅ PASS' : '❌ FAIL');
console.log();

// Test Case 3: Edge Cases
console.log('📝 Test 3: Edge Cases');
console.log('-'.repeat(60));

// ทดสอบ PID ที่มีตัวอักษรพิเศษ
const testPID3 = '0000000000000';
const encrypted3 = encryptPID(testPID3);
const decrypted3 = decryptPID(encrypted3);
console.log('All Zeros PID:', testPID3 === decrypted3 ? '✅ PASS' : '❌ FAIL');

// ทดสอบ PID ที่ยาว
const testPID4 = '1234567890123456789';
const encrypted4 = encryptPID(testPID4);
const decrypted4 = decryptPID(encrypted4);
console.log('Long PID:', testPID4 === decrypted4 ? '✅ PASS' : '❌ FAIL');
console.log();

// Test Case 4: Error Handling
console.log('📝 Test 4: Error Handling');
console.log('-'.repeat(60));

try {
    const invalidEncrypted = 'invalid:encrypted:data';
    decryptPID(invalidEncrypted);
    console.log('Invalid Format Handling: ❌ FAIL (should throw error)');
} catch (error) {
    console.log('Invalid Format Handling: ✅ PASS (error caught correctly)');
}

try {
    const incompleteEncrypted = 'onlyonepart';
    decryptPID(incompleteEncrypted);
    console.log('Incomplete Data Handling: ❌ FAIL (should throw error)');
} catch (error) {
    console.log('Incomplete Data Handling: ✅ PASS (error caught correctly)');
}
console.log();

// Summary
console.log('='.repeat(60));
console.log('✨ All Tests Completed!');
console.log('='.repeat(60));
console.log();
console.log('ℹ️  การเข้ารหัส PID ใช้ AES-256-GCM ซึ่งเป็นมาตรฐานสากล');
console.log('ℹ️  ข้อมูลที่เข้ารหัสมีรูปแบบ: [IV]:[Data]:[AuthTag]');
console.log('ℹ️  SECRET_KEY ที่ใช้:', process.env.SECRET_KEY || 'NOT SET');
console.log();
