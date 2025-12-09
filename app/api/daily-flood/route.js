import { NextResponse } from 'next/server';

// จำลองข้อมูลพื้นที่น้ำท่วมรายวัน
// ในการใช้งานจริงควรดึงจาก MySQL database
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date'); // รูปแบบ: YYYY-MM-DD

        // ข้อมูลจำลองสำหรับแต่ละวัน
        const dailyFloodData = {
            '2025-12-01': {
                date: '2025-12-01',
                districts: [
                    { name: 'เมืองสตูล', level: 'severe', affectedArea: 45.5, population: 12000 },
                    { name: 'ควนโดน', level: 'moderate', affectedArea: 30.2, population: 8000 },
                    { name: 'ท่าแพ', level: 'mild', affectedArea: 15.8, population: 3000 },
                ],
                summary: {
                    totalAffected: 3,
                    severeCount: 1,
                    moderateCount: 1,
                    mildCount: 1,
                    totalPopulation: 23000,
                }
            },
            '2025-12-02': {
                date: '2025-12-02',
                districts: [
                    { name: 'เมืองสตูล', level: 'severe', affectedArea: 48.2, population: 13500 },
                    { name: 'ควนโดน', level: 'severe', affectedArea: 35.7, population: 9500 },
                    { name: 'ท่าแพ', level: 'moderate', affectedArea: 22.3, population: 5000 },
                ],
                summary: {
                    totalAffected: 3,
                    severeCount: 2,
                    moderateCount: 1,
                    mildCount: 0,
                    totalPopulation: 28000,
                }
            },
            '2025-12-03': {
                date: '2025-12-03',
                districts: [
                    { name: 'เมืองสตูล', level: 'severe', affectedArea: 52.0, population: 15000 },
                    { name: 'ควนโดน', level: 'severe', affectedArea: 40.5, population: 11000 },
                    { name: 'ท่าแพ', level: 'moderate', affectedArea: 28.0, population: 6500 },
                    { name: 'ละงู', level: 'mild', affectedArea: 12.0, population: 2000 },
                ],
                summary: {
                    totalAffected: 4,
                    severeCount: 2,
                    moderateCount: 1,
                    mildCount: 1,
                    totalPopulation: 34500,
                }
            },
            '2025-12-04': {
                date: '2025-12-04',
                districts: [
                    { name: 'เมืองสตูล', level: 'severe', affectedArea: 55.8, population: 16500 },
                    { name: 'ควนโดน', level: 'severe', affectedArea: 45.2, population: 12500 },
                    { name: 'ท่าแพ', level: 'severe', affectedArea: 32.5, population: 8000 },
                    { name: 'ละงู', level: 'moderate', affectedArea: 18.5, population: 4000 },
                ],
                summary: {
                    totalAffected: 4,
                    severeCount: 3,
                    moderateCount: 1,
                    mildCount: 0,
                    totalPopulation: 41000,
                }
            },
            '2025-12-05': {
                date: '2025-12-05',
                districts: [
                    { name: 'เมืองสตูล', level: 'severe', affectedArea: 58.0, population: 17000 },
                    { name: 'ควนโดน', level: 'severe', affectedArea: 48.0, population: 13000 },
                    { name: 'ท่าแพ', level: 'moderate', affectedArea: 35.0, population: 9000 },
                    { name: 'ละงู', level: 'mild', affectedArea: 20.0, population: 4500 },
                ],
                summary: {
                    totalAffected: 4,
                    severeCount: 2,
                    moderateCount: 1,
                    mildCount: 1,
                    totalPopulation: 43500,
                }
            },
            '2025-12-06': {
                date: '2025-12-06',
                districts: [
                    { name: 'เมืองสตูล', level: 'moderate', affectedArea: 42.0, population: 12000 },
                    { name: 'ควนโดน', level: 'moderate', affectedArea: 38.0, population: 10000 },
                    { name: 'ท่าแพ', level: 'mild', affectedArea: 25.0, population: 6000 },
                    { name: 'ละงู', level: 'safe', affectedArea: 0, population: 0 },
                ],
                summary: {
                    totalAffected: 3,
                    severeCount: 0,
                    moderateCount: 2,
                    mildCount: 1,
                    totalPopulation: 28000,
                }
            },
            '2025-12-07': {
                date: '2025-12-07',
                districts: [
                    { name: 'เมืองสตูล', level: 'moderate', affectedArea: 35.0, population: 10000 },
                    { name: 'ควนโดน', level: 'mild', affectedArea: 28.0, population: 7000 },
                    { name: 'ท่าแพ', level: 'mild', affectedArea: 18.0, population: 4000 },
                    { name: 'ละงู', level: 'safe', affectedArea: 0, population: 0 },
                    { name: 'ทุ่งหว้า', level: 'safe', affectedArea: 0, population: 0 },
                ],
                summary: {
                    totalAffected: 3,
                    severeCount: 0,
                    moderateCount: 1,
                    mildCount: 2,
                    totalPopulation: 21000,
                }
            },
            '2025-12-08': {
                date: '2025-12-08',
                districts: [
                    { name: 'เมืองสตูล', level: 'mild', affectedArea: 25.0, population: 6000 },
                    { name: 'ควนโดน', level: 'mild', affectedArea: 20.0, population: 5000 },
                    { name: 'ท่าแพ', level: 'safe', affectedArea: 0, population: 0 },
                    { name: 'ละงู', level: 'safe', affectedArea: 0, population: 0 },
                    { name: 'ทุ่งหว้า', level: 'safe', affectedArea: 0, population: 0 },
                ],
                summary: {
                    totalAffected: 2,
                    severeCount: 0,
                    moderateCount: 0,
                    mildCount: 2,
                    totalPopulation: 11000,
                }
            },
            '2025-12-09': {
                date: '2025-12-09',
                districts: [
                    { name: 'เมืองสตูล', level: 'mild', affectedArea: 15.0, population: 3000 },
                    { name: 'ควนโดน', level: 'safe', affectedArea: 0, population: 0 },
                    { name: 'ท่าแพ', level: 'safe', affectedArea: 0, population: 0 },
                    { name: 'ละงู', level: 'safe', affectedArea: 0, population: 0 },
                    { name: 'ทุ่งหว้า', level: 'safe', affectedArea: 0, population: 0 },
                    { name: 'มะนัง', level: 'safe', affectedArea: 0, population: 0 },
                    { name: 'ควนกาหลง', level: 'safe', affectedArea: 0, population: 0 },
                ],
                summary: {
                    totalAffected: 1,
                    severeCount: 0,
                    moderateCount: 0,
                    mildCount: 1,
                    totalPopulation: 3000,
                }
            },
        };

        if (date) {
            // ส่งข้อมูลของวันที่ที่ระบุ
            const data = dailyFloodData[date] || {
                date: date,
                districts: [],
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
            // ส่งข้อมูลทั้งหมด
            return NextResponse.json(dailyFloodData);
        }

    } catch (error) {
        console.error('Error fetching daily flood data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch daily flood data' },
            { status: 500 }
        );
    }
}

// สำหรับการเพิ่มข้อมูลใหม่ (ถ้าต้องการ)
export async function POST(request) {
    try {
        const data = await request.json();

        // ในการใช้งานจริง ควรบันทึกลง database
        console.log('Received flood data:', data);

        return NextResponse.json({
            success: true,
            message: 'Data received successfully',
            data: data
        });

    } catch (error) {
        console.error('Error saving flood data:', error);
        return NextResponse.json(
            { error: 'Failed to save flood data' },
            { status: 500 }
        );
    }
}
