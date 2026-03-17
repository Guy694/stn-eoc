// ข้อมูล configuration สำหรับแต่ละ disaster module
// ระบบจะโหลดข้อมูลจาก database ก่อน ถ้าไม่มีหรือ error จะใช้ค่า default นี้

let dynamicDisasterTypes = null; // cache สำหรับข้อมูลจาก database

export const DISASTER_TYPES = {
    FLOOD: 'flood',
    DISEASE: 'disease'
};

// ดึงข้อมูล EOC Types จาก database (eoc_status table)
export const fetchEOCTypesFromDB = async () => {
    try {
        const response = await fetch('/stn-eoc/api/admin/eoc-types?active=true');
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
            dynamicDisasterTypes = result.data.map(item => item.id);
            return result.data;
        }
        return null;
    } catch (error) {
        console.error("Error fetching EOC types from DB:", error);
        return null;
    }
};

export const DISASTER_CONFIG = {
    flood: {
        id: 'flood',
        name: 'น้ำท่วม',
        nameEn: 'Flood',
        icon: '💧',
        color: {
            primary: 'blue',
            gradient: 'from-blue-500 to-blue-600',
            light: 'bg-blue-50',
            border: 'border-blue-200',
            text: 'text-blue-700'
        },
        routes: {
            main: '/eoc/flood',
            map: '/eoc/flood',
            dailyRisk: '/eoc/flood/daily-risk',
            reports: '/eoc/flood/reports',
            history: '/eoc/flood/history'
        },
        api: {
            sessions: '/stn-eoc/api/eoc/flood/sessions-summary',
            dailyRisk: '/stn-eoc/api/eoc/flood/daily-risk',
            dailyData: '/stn-eoc/api/eoc/flood/daily-flood-village'
        },
        fields: {
            riskLevel: 'flood_level',
            waterLevel: 'water_level_cm',
            affectedArea: 'affected_area'
        },
        riskLevels: [
            { value: 'severe', label: 'รุนแรงมาก', icon: '🔴', color: 'red' },
            { value: 'moderate', label: 'ปานกลาง', icon: '🟡', color: 'yellow' },
            { value: 'mild', label: 'เล็กน้อย', icon: '🔵', color: 'blue' },
            { value: 'safe', label: 'ปลอดภัย', icon: '🟢', color: 'green' }
        ],
        metrics: [
            { key: 'water_level_cm', label: 'ระดับน้ำ', unit: 'ซม.', icon: '📏' },
            { key: 'affected_area', label: 'พื้นที่ท่วม', unit: 'ตร.ก.ม.', icon: '📐' },
            { key: 'duration_days', label: 'ระยะเวลา', unit: 'วัน', icon: '⏱️' }
        ]
    },

    disease: {
        id: 'disease',
        name: 'โรคระบาด',
        nameEn: 'Disease Outbreak',
        icon: '🦠',
        color: {
            primary: 'red',
            gradient: 'from-red-500 to-pink-600',
            light: 'bg-red-50',
            border: 'border-red-200',
            text: 'text-red-700'
        },
        routes: {
            main: '/eoc/disease',
            map: '/eoc/disease',
            dailyRisk: '/eoc/disease/daily-risk',
            reports: '/eoc/disease/reports',
            history: '/eoc/disease/history'
        },
        api: {
            sessions: '/stn-eoc/api/eoc/disease/sessions-summary',
            dailyRisk: '/stn-eoc/api/eoc/disease/daily-risk',
            dailyData: '/stn-eoc/api/eoc/disease/daily-cases'
        },
        fields: {
            riskLevel: 'outbreak_level',
            cases: 'confirmed_cases',
            deaths: 'deaths'
        },
        riskLevels: [
            { value: 'pandemic', label: 'ระบาดใหญ่', icon: '🔴', color: 'red' },
            { value: 'epidemic', label: 'ระบาด', icon: '🟠', color: 'orange' },
            { value: 'outbreak', label: 'เฝ้าระวัง', icon: '🟡', color: 'yellow' },
            { value: 'controlled', label: 'ควบคุมได้', icon: '🟢', color: 'green' }
        ],
        metrics: [
            { key: 'confirmed_cases', label: 'ผู้ป่วยยืนยัน', unit: 'ราย', icon: '🤒' },
            { key: 'deaths', label: 'เสียชีวิต', unit: 'ราย', icon: '💀' },
            { key: 'recovered', label: 'หายแล้ว', unit: 'ราย', icon: '😊' },
            { key: 'infection_rate', label: 'อัตราการติดเชื้อ', unit: '%', icon: '📈' }
        ]
    }
};

// Helper functions
export const getDisasterConfig = (disasterType) => {
    return DISASTER_CONFIG[disasterType] || null;
};

export const getAllDisasterTypes = async () => {
    // พยายามโหลดจาก database ก่อน
    if (typeof window !== 'undefined') { // ตรวจสอบว่าอยู่ใน client-side
        try {
            const dbTypes = await fetchEOCTypesFromDB();
            if (dbTypes && dbTypes.length > 0) {
                return dbTypes.map(item => item.id);
            }
        } catch (error) {
            console.error("Error loading dynamic types:", error);
        }
    }

    // fallback ไปใช้ค่า default
    return Object.values(DISASTER_TYPES);
};

// สำหรับใช้แบบ sync (ไม่รอ database)
export const getAllDisasterTypesSync = () => {
    return dynamicDisasterTypes || Object.values(DISASTER_TYPES);
};

export const getDisasterName = (disasterType, lang = 'th') => {
    const config = getDisasterConfig(disasterType);
    return config ? (lang === 'en' ? config.nameEn : config.name) : disasterType;
};

export const getDisasterIcon = (disasterType) => {
    const config = getDisasterConfig(disasterType);
    return config ? config.icon : '⚠️';
};

export const getDisasterColor = (disasterType) => {
    const config = getDisasterConfig(disasterType);
    return config ? config.color : {
        primary: 'gray',
        gradient: 'from-gray-500 to-gray-600',
        light: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-700'
    };
};

export const getRiskLevelConfig = (disasterType, riskValue) => {
    const config = getDisasterConfig(disasterType);
    if (!config) return null;
    return config.riskLevels.find(level => level.value === riskValue) || null;
};

export const getRiskLevelColor = (disasterType, riskValue) => {
    const levelConfig = getRiskLevelConfig(disasterType, riskValue);
    return levelConfig ? levelConfig.color : 'gray';
};

export const getRiskLevelIcon = (disasterType, riskValue) => {
    const levelConfig = getRiskLevelConfig(disasterType, riskValue);
    return levelConfig ? levelConfig.icon : '⚪';
};

export const getRiskLevelLabel = (disasterType, riskValue) => {
    const levelConfig = getRiskLevelConfig(disasterType, riskValue);
    return levelConfig ? levelConfig.label : riskValue;
};

// Color utility functions
export const getRiskColorClasses = (color) => {
    const colorMap = {
        red: 'bg-red-100 border-red-400 text-red-800',
        orange: 'bg-orange-100 border-orange-400 text-orange-800',
        yellow: 'bg-yellow-100 border-yellow-400 text-yellow-800',
        blue: 'bg-blue-100 border-blue-400 text-blue-800',
        cyan: 'bg-cyan-100 border-cyan-400 text-cyan-800',
        green: 'bg-green-100 border-green-400 text-green-800',
        gray: 'bg-gray-100 border-gray-400 text-gray-800'
    };
    return colorMap[color] || colorMap.gray;
};

export default DISASTER_CONFIG;
