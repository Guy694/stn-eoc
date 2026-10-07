import {
  distanceKm,
  facilityTypeInfo,
  floodAreaAt,
  isStatusStale,
  markerTone,
  nearby,
  normalizeFloodStatus,
  normalizeServiceStatus,
  phoneLinks,
  pointInGeometry,
  serviceStatusMeta
} from '@/lib/healthFacilityStatus';

const square = { type: 'Polygon', coordinates: [[[100, 6], [100.1, 6], [100.1, 6.1], [100, 6.1], [100, 6]]] };

describe('healthFacilityStatus', () => {
  test('ประเภทหน่วยบริการ: โรงพยาบาล / ปฐมภูมิ / สำนักงาน', () => {
    expect(facilityTypeInfo('รพ.ชุมชน').level).toBe('hospital');
    expect(facilityTypeInfo('รพ.สต.').level).toBe('primary');
    expect(facilityTypeInfo('สสอ.').level).toBe('office');
    expect(facilityTypeInfo('อื่นๆ').label).toBe('อื่นๆ');
  });

  test('สถานะที่ไม่รู้จักถือว่ายังไม่มีรายงาน และ normalize ตัดค่าแปลก', () => {
    expect(serviceStatusMeta(null).value).toBe('unknown');
    expect(normalizeServiceStatus('closed')).toBe('closed');
    expect(normalizeServiceStatus('drop table')).toBeNull();
    expect(normalizeFloodStatus('flooded')).toBe('flooded');
    expect(normalizeFloodStatus('x')).toBeNull();
  });

  test('สีหมุด: ปิดหรือน้ำท่วม = แดง, จำกัดหรือถนนท่วม = เหลือง', () => {
    expect(markerTone({ service_status: 'open', flood_status: 'flooded' }).value).toBe('closed');
    expect(markerTone({ service_status: 'open', flood_status: 'access_cut' }).value).toBe('limited');
    expect(markerTone({ service_status: 'open' }).value).toBe('open');
    expect(markerTone({}).value).toBe('unknown');
  });

  test('แยกหลายเบอร์เป็นลิงก์โทร', () => {
    expect(phoneLinks('074-711-010, 081 234 5678')).toEqual([
      { label: '074-711-010', href: 'tel:074711010' },
      { label: '081 234 5678', href: 'tel:0812345678' }
    ]);
    expect(phoneLinks('')).toEqual([]);
  });

  test('สถานะเก่าเกิน 24 ชม. หรือไม่มีเวลา = อาจไม่เป็นปัจจุบัน', () => {
    const now = Date.parse('2026-10-07T12:00:00Z');
    expect(isStatusStale('2026-10-07T01:00:00Z', now)).toBe(false);
    expect(isStatusStale('2026-10-06T01:00:00Z', now)).toBe(true);
    expect(isStatusStale(null, now)).toBe(true);
  });

  test('จุดอยู่ในพื้นที่น้ำท่วม (Polygon, MultiPolygon, Feature)', () => {
    expect(pointInGeometry(6.05, 100.05, square)).toBe(true);
    expect(pointInGeometry(6.2, 100.05, square)).toBe(false);
    expect(pointInGeometry(6.05, 100.05, { type: 'MultiPolygon', coordinates: [square.coordinates] })).toBe(true);
    expect(pointInGeometry(6.05, 100.05, { type: 'Feature', geometry: square })).toBe(true);
    const area = { id: 1, geometry: square };
    expect(floodAreaAt(6.05, 100.05, [{ id: 2 }, area])).toBe(area);
    expect(floodAreaAt(7, 100, [area])).toBeNull();
  });

  test('หาสิ่งที่อยู่ใกล้ในรัศมี เรียงใกล้ก่อน', () => {
    expect(distanceKm(6.6, 100.0, 6.6, 100.0)).toBe(0);
    const rows = nearby(6.6, 100.0, [
      { id: 'far', latitude: '6.62', longitude: '100.0' },
      { id: 'near', lat: 6.601, lng: 100.0 },
      { id: 'bad', lat: null }
    ], 1);
    expect(rows.map((row) => row.item.id)).toEqual(['near']);
  });
});
