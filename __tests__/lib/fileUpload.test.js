const {
    hasValidImageSignature,
    isSafeFilename,
    resolveInside
} = require('@/lib/fileUpload');

describe('file upload helpers', () => {
    test('validates image magic bytes', () => {
        const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x00]);
        const jpg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
        const webp = Buffer.from('RIFFxxxxWEBP', 'ascii');

        expect(hasValidImageSignature(png, 'image/png')).toBe(true);
        expect(hasValidImageSignature(jpg, 'image/jpeg')).toBe(true);
        expect(hasValidImageSignature(webp, 'image/webp')).toBe(true);
        expect(hasValidImageSignature(Buffer.from('not an image file'), 'image/png')).toBe(false);
    });

    test('allows only safe generated-style filenames', () => {
        expect(isSafeFilename('1710000000000-abcdef123456.png')).toBe(true);
        expect(isSafeFilename('../secret.png')).toBe(false);
        expect(isSafeFilename('nested/file.png')).toBe(false);
        expect(isSafeFilename('.hidden.png')).toBe(false);
        expect(isSafeFilename('bad name.png')).toBe(false);
    });

    test('prevents resolving paths outside the base directory', () => {
        const baseDir = '/tmp/stn-eoc/uploads';

        expect(resolveInside(baseDir, 'incidents', 'photo.png')).toBe('/tmp/stn-eoc/uploads/incidents/photo.png');
        expect(() => resolveInside(baseDir, '..', 'secret.png')).toThrow('Invalid file path');
    });
});
