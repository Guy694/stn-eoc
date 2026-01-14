// ข้อมูลอำเภอของจังหวัดสตูล (ครบ 36 ตำบล ตามฐานข้อมูล)
export const satunDistricts = [
    {
        id: 1,
        name: "เมืองสตูล",
        nameEn: "Mueang Satun",
        tambons: [
            { id: 1, name: "พิมาน" },
            { id: 2, name: "คลองขุด" },
            { id: 3, name: "บ้านควน" },
            { id: 4, name: "เกาะสาหร่าย" },
            { id: 5, name: "ฉลุง" },
            { id: 6, name: "ควนขัน" },
            { id: 7, name: "ควนโพธิ์" },
            { id: 8, name: "ตันหยงโป" },
            { id: 9, name: "ตำมะลัง" },
            { id: 10, name: "ปูยู" },
            { id: 11, name: "เกตรี" },
            { id: 12, name: "เจ๊ะบิลัง" },
        ],
    },
    {
        id: 2,
        name: "ควนโดน",
        nameEn: "Khuan Don",
        tambons: [
            { id: 1, name: "ควนโดน" },
            { id: 2, name: "ควนสตอ" },
            { id: 3, name: "ย่านซื่อ" },
            { id: 4, name: "วังประจัน" },
        ],
    },
    {
        id: 3,
        name: "ควนกาหลง",
        nameEn: "Khuan Kalong",
        tambons: [
            { id: 1, name: "ควนกาหลง" },
            { id: 2, name: "ทุ่งนุ้ย" },
            { id: 3, name: "อุใดเจริญ" },
        ],
    },
    {
        id: 4,
        name: "ท่าแพ",
        nameEn: "Tha Phae",
        tambons: [
            { id: 1, name: "ท่าแพ" },
            { id: 2, name: "ท่าเรือ" },
            { id: 3, name: "สาคร" },
            { id: 4, name: "แป-ระ" },
        ],
    },
    {
        id: 5,
        name: "ละงู",
        nameEn: "La-ngu",
        tambons: [
            { id: 1, name: "กำแพง" },
            { id: 2, name: "น้ำผุด" },
            { id: 3, name: "ปากน้ำ" },
            { id: 4, name: "ละงู" },
            { id: 5, name: "เขาขาว" },
            { id: 6, name: "แหลมสน" },
        ],
    },
    {
        id: 6,
        name: "ทุ่งหว้า",
        nameEn: "Thung Wa",
        tambons: [
            { id: 1, name: "ขอนคลาน" },
            { id: 2, name: "ทุ่งบุหลัง" },
            { id: 3, name: "ทุ่งหว้า" },
            { id: 4, name: "นาทอน" },
            { id: 5, name: "ป่าแก่บ่อหิน" },
        ],
    },
    {
        id: 7,
        name: "มะนัง",
        nameEn: "Manang",
        tambons: [
            { id: 1, name: "นิคมพัฒนา" },
            { id: 2, name: "ปาล์มพัฒนา" },
        ],
    },
];

// ข้อมูลจุดเกิดเหตุการณ์ตัวอย่าง (Lat, Lng ของจังหวัดสตูลและพื้นที่ใกล้เคียง)
export const disasterEvents = [
    {
        id: 1,
        type: "น้ำท่วม",
        severity: "สูง",
        district: "เมืองสตูล",
        tambon: "พิมาน",
        village: "หมู่ 1",
        lat: 6.6238,
        lng: 100.0673,
        date: "2025-12-05",
        description: "น้ำท่วมขังบริเวณถนนสายหลัก ระดับน้ำ 50 ซม.",
        affected: 45,
        status: "กำลังดำเนินการ",
    },
    {
        id: 2,
        type: "ดินถ่ม",
        severity: "ปานกลาง",
        district: "ควนโดน",
        tambon: "ควนโดน",
        village: "หมู่ 3",
        lat: 6.7544,
        lng: 100.1234,
        date: "2025-12-03",
        description: "ดินถ่มจากเนินเขาบริเวณถนนสาย 416",
        affected: 12,
        status: "ติดตาม",
    },
    {
        id: 3,
        type: "พายุ",
        severity: "สูง",
        district: "ละงู",
        tambon: "ปากน้ำ",
        village: "หมู่ 2",
        lat: 6.8654,
        lng: 99.7812,
        date: "2025-12-07",
        description: "พายุฝนตกหนักบริเวณชายฝั่งทะเล",
        affected: 89,
        status: "ฉุกเฉิน",
    },
    {
        id: 4,
        type: "น้ำท่วม",
        severity: "ปานกลาง",
        district: "ท่าแพ",
        tambon: "ท่าแพ",
        village: "หมู่ 4",
        lat: 6.8123,
        lng: 100.0567,
        date: "2025-12-06",
        description: "น้ำท่วมพื้นที่การเกษตร ประมาณ 200 ไร่",
        affected: 23,
        status: "กำลังดำเนินการ",
    },
    {
        id: 5,
        type: "ไฟป่า",
        severity: "ต่ำ",
        district: "ทุ่งหว้า",
        tambon: "ทุ่งหว้า",
        village: "หมู่ 2",
        lat: 6.9234,
        lng: 100.1456,
        date: "2025-12-02",
        description: "ไฟไหม้ป่าบริเวณภูเขา พื้นที่ 15 ไร่",
        affected: 0,
        status: "แก้ไขแล้ว",
    },
    {
        id: 6,
        type: "แผ่นดินไหว",
        severity: "ต่ำ",
        district: "ควนกาหลง",
        tambon: "ควนกาหลง",
        village: "หมู่ 1",
        lat: 6.7345,
        lng: 100.0923,
        date: "2025-12-04",
        description: "แผ่นดินไหวขนาดเล็ก 2.3 ริกเตอร์",
        affected: 0,
        status: "ติดตาม",
    },
    {
        id: 7,
        type: "น้ำท่วม",
        severity: "สูง",
        district: "มะนัง",
        tambon: "ปาล์มพัฒนา",
        village: "หมู่ 3",
        lat: 6.8567,
        lng: 100.2134,
        date: "2025-12-08",
        description: "น้ำท่วมสวนปาล์มและพื้นที่เกษตรกรรม",
        affected: 67,
        status: "ฉุกเฉิน",
    },
];

// ฟังก์ชันกรองข้อมูลตามวันที่
export const filterEventsByDays = (events, days) => {
    if (days === "all") return events;

    const today = new Date();
    const targetDate = new Date();
    targetDate.setDate(today.getDate() - days);

    return events.filter((event) => {
        const eventDate = new Date(event.date);
        return eventDate >= targetDate;
    });
};

// สีตามประเภทภัย
export const disasterTypeColors = {
    "น้ำท่วม": "#3B82F6", // blue
    "ดินถ่ม": "#A855F7", // purple
    "พายุ": "#EF4444", // red
    "ไฟป่า": "#F59E0B", // orange
    "แผ่นดินไหว": "#10B981", // green
};

// สีตามความรุนแรง
export const severityColors = {
    "สูง": "#DC2626",
    "ปานกลาง": "#F59E0B",
    "ต่ำ": "#10B981",
};
