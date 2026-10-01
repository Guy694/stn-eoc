// เครื่องมือช่วยลดความละเอียดของข้อมูลส่วนบุคคลก่อนแสดงบนหน้าสาธารณะ (PDPA)

// ทศนิยม 3 ตำแหน่ง ≈ 110 เมตร: พอสำหรับแสดงพื้นที่ประสบเหตุบนแผนที่ แต่ไม่ชี้ถึงบ้านรายหลัง
export const PUBLIC_COORDINATE_DECIMALS = 3;

export function coarsenCoordinate(value, decimals = PUBLIC_COORDINATE_DECIMALS) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    const factor = 10 ** decimals;
    return Math.round(number * factor) / factor;
}

export function coarsenLocation(record, { latKey = 'latitude', lngKey = 'longitude', decimals } = {}) {
    if (!record) return record;
    return {
        ...record,
        [latKey]: coarsenCoordinate(record[latKey], decimals),
        [lngKey]: coarsenCoordinate(record[lngKey], decimals),
        location_precision: 'approximate'
    };
}
