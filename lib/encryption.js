/**
 * Encryption utilities for sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */

const crypto = require('crypto');

/**
 * Encrypt a PID using AES-256-GCM
 * @param {string} pid - The PID to encrypt
 * @returns {string} Encrypted PID in format: iv:encryptedData:authTag
 * @throws {Error} If SECRET_KEY is not defined
 */
function encryptPID(pid) {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey) {
        throw new Error('SECRET_KEY is not defined in environment variables');
    }

    // Create 32-byte key from SECRET_KEY
    const key = crypto.createHash('sha256').update(secretKey).digest();

    // Generate random initialization vector (IV)
    const iv = crypto.randomBytes(16);

    // Create cipher with AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // Encrypt data
    let encrypted = cipher.update(pid, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine IV + encrypted data + auth tag (separated by :)
    return iv.toString('hex') + ':' + encrypted + ':' + authTag.toString('hex');
}

/**
 * Decrypt a PID that was encrypted with encryptPID
 * @param {string} encryptedPID - The encrypted PID in format: iv:encryptedData:authTag
 * @returns {string} Decrypted PID
 * @throws {Error} If SECRET_KEY is not defined or decryption fails
 */
function decryptPID(encryptedPID) {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey) {
        throw new Error('SECRET_KEY is not defined in environment variables');
    }

    try {
        // Split IV, encrypted data, and auth tag
        const parts = encryptedPID.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted PID format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const authTag = Buffer.from(parts[2], 'hex');

        // Create 32-byte key from SECRET_KEY
        const key = crypto.createHash('sha256').update(secretKey).digest();

        // Create decipher
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        // Decrypt
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        throw new Error('Failed to decrypt PID');
    }
}

module.exports = {
    encryptPID,
    decryptPID
};
