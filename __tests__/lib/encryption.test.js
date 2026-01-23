/**
 * Unit tests for encryption utilities
 */

const { encryptPID, decryptPID } = require('@/lib/encryption');

describe('PID Encryption', () => {
    beforeAll(() => {
        // Ensure SECRET_KEY is set for testing
        process.env.SECRET_KEY = 'test_secret_key_for_testing_purposes';
    });

    describe('encryptPID', () => {
        test('should encrypt a valid PID', () => {
            const pid = '1234567890123';
            const encrypted = encryptPID(pid);

            // Encrypted string should have the format: iv:encryptedData:authTag
            expect(encrypted).toBeTruthy();
            expect(typeof encrypted).toBe('string');
            expect(encrypted.split(':')).toHaveLength(3);
        });

        test('should produce different ciphertext for the same PID', () => {
            const pid = '1234567890123';
            const encrypted1 = encryptPID(pid);
            const encrypted2 = encryptPID(pid);

            // Each encryption should produce different results due to random IV
            expect(encrypted1).not.toBe(encrypted2);
        });

        test('should encrypt PIDs with all zeros', () => {
            const pid = '0000000000000';
            const encrypted = encryptPID(pid);

            expect(encrypted).toBeTruthy();
            expect(encrypted.split(':')).toHaveLength(3);
        });

        test('should encrypt long PIDs', () => {
            const pid = '1234567890123456789';
            const encrypted = encryptPID(pid);

            expect(encrypted).toBeTruthy();
            expect(encrypted.split(':')).toHaveLength(3);
        });

        test('should throw error if SECRET_KEY is not defined', () => {
            const originalKey = process.env.SECRET_KEY;
            delete process.env.SECRET_KEY;

            expect(() => {
                encryptPID('1234567890123');
            }).toThrow('SECRET_KEY is not defined');

            process.env.SECRET_KEY = originalKey;
        });

        test('should encrypt empty string', () => {
            const pid = '';
            const encrypted = encryptPID(pid);

            expect(encrypted).toBeTruthy();
            expect(encrypted.split(':')).toHaveLength(3);
        });
    });

    describe('decryptPID', () => {
        test('should decrypt an encrypted PID correctly', () => {
            const originalPID = '1234567890123';
            const encrypted = encryptPID(originalPID);
            const decrypted = decryptPID(encrypted);

            expect(decrypted).toBe(originalPID);
        });

        test('should decrypt multiple encryptions of the same PID to the same value', () => {
            const originalPID = '9876543210987';
            const encrypted1 = encryptPID(originalPID);
            const encrypted2 = encryptPID(originalPID);

            const decrypted1 = decryptPID(encrypted1);
            const decrypted2 = decryptPID(encrypted2);

            expect(decrypted1).toBe(originalPID);
            expect(decrypted2).toBe(originalPID);
            expect(decrypted1).toBe(decrypted2);
        });

        test('should throw error for invalid format', () => {
            expect(() => {
                decryptPID('invalid:format');
            }).toThrow('Failed to decrypt PID');
        });

        test('should throw error for incomplete encrypted data', () => {
            expect(() => {
                decryptPID('onlyonepart');
            }).toThrow('Failed to decrypt PID');
        });

        test('should throw error for completely invalid data', () => {
            expect(() => {
                decryptPID('totally:invalid:data');
            }).toThrow('Failed to decrypt PID');
        });

        test('should throw error if SECRET_KEY is not defined', () => {
            const originalKey = process.env.SECRET_KEY;
            const encrypted = encryptPID('1234567890123');
            delete process.env.SECRET_KEY;

            expect(() => {
                decryptPID(encrypted);
            }).toThrow('SECRET_KEY is not defined');

            process.env.SECRET_KEY = originalKey;
        });

        test('should throw error if decrypted with wrong SECRET_KEY', () => {
            const originalPID = '1234567890123';
            const encrypted = encryptPID(originalPID);

            // Change SECRET_KEY
            process.env.SECRET_KEY = 'different_secret_key';

            expect(() => {
                decryptPID(encrypted);
            }).toThrow('Failed to decrypt PID');

            // Restore original key
            process.env.SECRET_KEY = 'test_secret_key_for_testing_purposes';
        });
    });

    describe('Round-trip encryption/decryption', () => {
        const testCases = [
            { name: 'standard PID', pid: '1234567890123' },
            { name: 'all zeros', pid: '0000000000000' },
            { name: 'long PID', pid: '1234567890123456789' },
            { name: 'short PID', pid: '123' },
            { name: 'empty string', pid: '' },
        ];

        testCases.forEach(({ name, pid }) => {
            test(`should successfully encrypt and decrypt ${name}`, () => {
                const encrypted = encryptPID(pid);
                const decrypted = decryptPID(encrypted);

                expect(decrypted).toBe(pid);
            });
        });
    });

    describe('Security properties', () => {
        test('encrypted data should be different from original', () => {
            const pid = '1234567890123';
            const encrypted = encryptPID(pid);

            expect(encrypted).not.toContain(pid);
        });

        test('should use different IV for each encryption', () => {
            const pid = '1234567890123';
            const encrypted1 = encryptPID(pid);
            const encrypted2 = encryptPID(pid);

            // Extract IVs (first part before first colon)
            const iv1 = encrypted1.split(':')[0];
            const iv2 = encrypted2.split(':')[0];

            expect(iv1).not.toBe(iv2);
        });

        test('encrypted format should have valid hex characters', () => {
            const pid = '1234567890123';
            const encrypted = encryptPID(pid);
            const parts = encrypted.split(':');

            // Each part should be valid hex
            parts.forEach(part => {
                expect(part).toMatch(/^[0-9a-f]+$/);
            });
        });
    });
});
