const { coarsenCoordinate, coarsenLocation } = require('@/lib/privacy');

describe('public location privacy', () => {
    test('rounds coordinates to ~100 m', () => {
        expect(coarsenCoordinate('6.62345678')).toBe(6.623);
        expect(coarsenCoordinate(100.06789)).toBe(100.068);
    });

    test('handles empty values', () => {
        expect(coarsenCoordinate(null)).toBeNull();
        expect(coarsenCoordinate('abc')).toBeNull();
    });

    test('marks records as approximate', () => {
        const result = coarsenLocation({ id: 1, latitude: 6.61111, longitude: 100.12345 });
        expect(result).toEqual({ id: 1, latitude: 6.611, longitude: 100.123, location_precision: 'approximate' });
    });
});
