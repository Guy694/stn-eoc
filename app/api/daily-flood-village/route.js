import { NextResponse } from 'next/server';

// จำลองข้อมูลพื้นที่น้ำท่วมรายวัน (ระดับหมู่บ้าน)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        // ข้อมูลจำลองระดับหมู่บ้าน - ควรดึงจาก MySQL จริง
        const villageFloodData = {
            '2025-12-01': {
                date: '2025-12-01',
                villages: [
                    { villcode: '9101010701', name: 'บ้านควนสะตอ', district: 'เมืองสตูล', level: 'severe', population: 450 },
                    { villcode: '9101010702', name: 'บ้านควนโพธิ์', district: 'เมืองสตูล', level: 'severe', population: 380 },
                    { villcode: '9101010801', name: 'บ้านบางหมาก', district: 'เมืองสตูล', level: 'moderate', population: 320 },
                    { villcode: '9101020901', name: 'บ้านคลองขุด', district: 'ควนโดน', level: 'moderate', population: 280 },
                    { villcode: '9101020902', name: 'บ้านทุ่งนุ้ย', district: 'ควนโดน', level: 'mild', population: 250 },
                    { villcode: '9101031001', name: 'บ้านคลองน้ำใส', district: 'ท่าแพ', level: 'mild', population: 180 },
                ],
                summary: {
                    totalAffected: 6,
                    severeCount: 2,
                    moderateCount: 2,
                    mildCount: 2,
                    totalPopulation: 1860,
                }
            },
            '2025-12-02': {
                date: '2025-12-02',
                villages: [
                    { villcode: '9101010701', name: 'บ้านควนสะตอ', district: 'เมืองสตูล', level: 'severe', population: 450 },
                    { villcode: '9101010702', name: 'บ้านควนโพธิ์', district: 'เมืองสตูล', level: 'severe', population: 380 },
                    { villcode: '9101010801', name: 'บ้านบางหมาก', district: 'เมืองสตูล', level: 'severe', population: 320 },
                    { villcode: '9101010802', name: 'บ้านทุ่งหว้า', district: 'เมืองสตูล', level: 'moderate', population: 290 },
                    { villcode: '9101020901', name: 'บ้านคลองขุด', district: 'ควนโดน', level: 'severe', population: 280 },
                    { villcode: '9101020902', name: 'บ้านทุ่งนุ้ย', district: 'ควนโดน', level: 'moderate', population: 250 },
                    { villcode: '9101031001', name: 'บ้านคลองน้ำใส', district: 'ท่าแพ', level: 'moderate', population: 180 },
                    { villcode: '9101031002', name: 'บ้านปากน้ำ', district: 'ท่าแพ', level: 'mild', population: 150 },
                ],
                summary: {
                    totalAffected: 8,
                    severeCount: 4,
                    moderateCount: 3,
                    mildCount: 1,
                    totalPopulation: 2300,
                }
            },
            '2025-12-03': {
                date: '2025-12-03',
                villages: [
                    { villcode: '9101010701', name: 'บ้านควนสะตอ', district: 'เมืองสตูล', level: 'severe', population: 450 },
                    { villcode: '9101010702', name: 'บ้านควนโพธิ์', district: 'เมืองสตูล', level: 'severe', population: 380 },
                    { villcode: '9101010801', name: 'บ้านบางหมาก', district: 'เมืองสตูล', level: 'severe', population: 320 },
                    { villcode: '9101010802', name: 'บ้านทุ่งหว้า', district: 'เมืองสตูล', level: 'severe', population: 290 },
                    { villcode: '9101020901', name: 'บ้านคลองขุด', district: 'ควนโดน', level: 'severe', population: 280 },
                    { villcode: '9101020902', name: 'บ้านทุ่งนุ้ย', district: 'ควนโดน', level: 'severe', population: 250 },
                    { villcode: '9101031001', name: 'บ้านคลองน้ำใส', district: 'ท่าแพ', level: 'moderate', population: 180 },
                    { villcode: '9101031002', name: 'บ้านปากน้ำ', district: 'ท่าแพ', level: 'moderate', population: 150 },
                    { villcode: '9101041101', name: 'บ้านควนกาหลง', district: 'ละงู', level: 'mild', population: 120 },
                ],
                summary: {
                    totalAffected: 9,
                    severeCount: 6,
                    moderateCount: 2,
                    mildCount: 1,
                    totalPopulation: 2420,
                }
            },
            '2025-12-04': {
                date: '2025-12-04',
                villages: [
                    { villcode: '9101010701', name: 'บ้านควนสะตอ', district: 'เมืองสตูล', level: 'severe', population: 450 },
                    { villcode: '9101010702', name: 'บ้านควนโพธิ์', district: 'เมืองสตูล', level: 'severe', population: 380 },
                    { villcode: '9101010801', name: 'บ้านบางหมาก', district: 'เมืองสตูล', level: 'severe', population: 320 },
                    { villcode: '9101010802', name: 'บ้านทุ่งหว้า', district: 'เมืองสตูล', level: 'severe', population: 290 },
                    { villcode: '9101020901', name: 'บ้านคลองขุด', district: 'ควนโดน', level: 'severe', population: 280 },
                    { villcode: '9101020902', name: 'บ้านทุ่งนุ้ย', district: 'ควนโดน', level: 'severe', population: 250 },
                    { villcode: '9101020903', name: 'บ้านคลองทราย', district: 'ควนโดน', level: 'moderate', population: 200 },
                    { villcode: '9101031001', name: 'บ้านคลองน้ำใส', district: 'ท่าแพ', level: 'severe', population: 180 },
                    { villcode: '9101031002', name: 'บ้านปากน้ำ', district: 'ท่าแพ', level: 'moderate', population: 150 },
                    { villcode: '9101041101', name: 'บ้านควนกาหลง', district: 'ละงู', level: 'moderate', population: 120 },
                ],
                summary: {
                    totalAffected: 10,
                    severeCount: 7,
                    moderateCount: 3,
                    mildCount: 0,
                    totalPopulation: 2620,
                }
            },
            '2025-12-05': {
                date: '2025-12-05',
                villages: [
                    { villcode: '9101010701', name: 'บ้านควนสะตอ', district: 'เมืองสตูล', level: 'severe', population: 450 },
                    { villcode: '9101010702', name: 'บ้านควนโพธิ์', district: 'เมืองสตูล', level: 'severe', population: 380 },
                    { villcode: '9101010801', name: 'บ้านบางหมาก', district: 'เมืองสตูล', level: 'moderate', population: 320 },
                    { villcode: '9101010802', name: 'บ้านทุ่งหว้า', district: 'เมืองสตูล', level: 'moderate', population: 290 },
                    { villcode: '9101020901', name: 'บ้านคลองขุด', district: 'ควนโดน', level: 'severe', population: 280 },
                    { villcode: '9101020902', name: 'บ้านทุ่งนุ้ย', district: 'ควนโดน', level: 'moderate', population: 250 },
                    { villcode: '9101020903', name: 'บ้านคลองทราย', district: 'ควนโดน', level: 'moderate', population: 200 },
                    { villcode: '9101031001', name: 'บ้านคลองน้ำใส', district: 'ท่าแพ', level: 'moderate', population: 180 },
                    { villcode: '9101031002', name: 'บ้านปากน้ำ', district: 'ท่าแพ', level: 'mild', population: 150 },
                    { villcode: '9101041101', name: 'บ้านควนกาหลง', district: 'ละงู', level: 'mild', population: 120 },
                ],
                summary: {
                    totalAffected: 10,
                    severeCount: 3,
                    moderateCount: 5,
                    mildCount: 2,
                    totalPopulation: 2620,
                }
            },
            '2025-12-06': {
                date: '2025-12-06',
                villages: [
                    { villcode: '9101010701', name: 'บ้านควนสะตอ', district: 'เมืองสตูล', level: 'moderate', population: 450 },
                    { villcode: '9101010702', name: 'บ้านควนโพธิ์', district: 'เมืองสตูล', level: 'moderate', population: 380 },
                    { villcode: '9101010801', name: 'บ้านบางหมาก', district: 'เมืองสตูล', level: 'mild', population: 320 },
                    { villcode: '9101020901', name: 'บ้านคลองขุด', district: 'ควนโดน', level: 'moderate', population: 280 },
                    { villcode: '9101020902', name: 'บ้านทุ่งนุ้ย', district: 'ควนโดน', level: 'mild', population: 250 },
                    { villcode: '9101031001', name: 'บ้านคลองน้ำใส', district: 'ท่าแพ', level: 'mild', population: 180 },
                ],
                summary: {
                    totalAffected: 6,
                    severeCount: 0,
                    moderateCount: 3,
                    mildCount: 3,
                    totalPopulation: 1860,
                }
            },
            '2025-12-07': {
                date: '2025-12-07',
                villages: [
                    { villcode: '9101010701', name: 'บ้านควนสะตอ', district: 'เมืองสตูล', level: 'mild', population: 450 },
                    { villcode: '9101010702', name: 'บ้านควนโพธิ์', district: 'เมืองสตูล', level: 'mild', population: 380 },
                    { villcode: '9101020901', name: 'บ้านคลองขุด', district: 'ควนโดน', level: 'mild', population: 280 },
                    { villcode: '9101031001', name: 'บ้านคลองน้ำใส', district: 'ท่าแพ', level: 'mild', population: 180 },
                ],
                summary: {
                    totalAffected: 4,
                    severeCount: 0,
                    moderateCount: 0,
                    mildCount: 4,
                    totalPopulation: 1290,
                }
            },
            '2025-12-08': {
                date: '2025-12-08',
                villages: [
                    { villcode: '9101010701', name: 'บ้านควนสะตอ', district: 'เมืองสตูล', level: 'mild', population: 450 },
                    { villcode: '9101020901', name: 'บ้านคลองขุด', district: 'ควนโดน', level: 'mild', population: 280 },
                ],
                summary: {
                    totalAffected: 2,
                    severeCount: 0,
                    moderateCount: 0,
                    mildCount: 2,
                    totalPopulation: 730,
                }
            },
            '2025-12-09': {
                date: '2025-12-09',
                villages: [
                    { villcode: '9101010701', name: 'บ้านควนสะตอ', district: 'เมืองสตูล', level: 'mild', population: 450 },
                ],
                summary: {
                    totalAffected: 1,
                    severeCount: 0,
                    moderateCount: 0,
                    mildCount: 1,
                    totalPopulation: 450,
                }
            },
        };

        if (date) {
            const data = villageFloodData[date] || {
                date: date,
                villages: [],
                summary: {
                    totalAffected: 0,
                    severeCount: 0,
                    moderateCount: 0,
                    mildCount: 0,
                    totalPopulation: 0,
                }
            };
            return NextResponse.json(data);
        } else {
            return NextResponse.json(villageFloodData);
        }

    } catch (error) {
        console.error('Error fetching village flood data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch village flood data' },
            { status: 500 }
        );
    }
}
