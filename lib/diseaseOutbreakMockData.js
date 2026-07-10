export const satunDistrictPopulations = {
    "เมืองสตูล": 116400,
    "ควนโดน": 23300,
    "ควนกาหลง": 43800,
    "ท่าแพ": 29900,
    "ละงู": 76000,
    "ทุ่งหว้า": 26500,
    "มะนัง": 19900
};

export const diseaseOutbreakMockData = {
    report_year: 2026,
    fiscal_year: 2569,
    province_code: "91",
    province_name: "สตูล",
    disease_code: "A90",
    disease_name_th: "โรคไข้เลือดออก",
    disease_name_en: "Dengue fever",
    disease_group: "โรคติดต่อนำโดยยุงลาย",
    outbreak_level: "เฝ้าระวัง",
    last_updated: "2026-07-09T08:30:00+07:00",
    latest_epi_week: 28,
    opened_at: "2026-06-24T09:00:00+07:00",
    weeklyTrend: [
        { epi_week: 21, "2566": 6, "2567": 8, "2568": 7, "2569": 10, baseline: 7 },
        { epi_week: 22, "2566": 8, "2567": 9, "2568": 8, "2569": 12, baseline: 8 },
        { epi_week: 23, "2566": 9, "2567": 10, "2568": 11, "2569": 15, baseline: 10 },
        { epi_week: 24, "2566": 12, "2567": 11, "2568": 13, "2569": 18, baseline: 12 },
        { epi_week: 25, "2566": 14, "2567": 13, "2568": 15, "2569": 22, baseline: 14 },
        { epi_week: 26, "2566": 16, "2567": 15, "2568": 18, "2569": 28, baseline: 16 },
        { epi_week: 27, "2566": 15, "2567": 18, "2568": 21, "2569": 33, baseline: 18 },
        { epi_week: 28, "2566": 17, "2567": 20, "2568": 24, "2569": 41, baseline: 20 }
    ],
    districtCases: [
        { district_name: "เมืองสตูล", total_cases: 86, new_cases: 18, deaths: 0, previous_week: 14, top_age_group: "10-14 ปี" },
        { district_name: "ละงู", total_cases: 61, new_cases: 9, deaths: 0, previous_week: 8, top_age_group: "15-24 ปี" },
        { district_name: "ควนกาหลง", total_cases: 38, new_cases: 6, deaths: 0, previous_week: 5, top_age_group: "5-9 ปี" },
        { district_name: "ท่าแพ", total_cases: 25, new_cases: 4, deaths: 0, previous_week: 5, top_age_group: "10-14 ปี" },
        { district_name: "ทุ่งหว้า", total_cases: 18, new_cases: 2, deaths: 0, previous_week: 2, top_age_group: "25-34 ปี" },
        { district_name: "ควนโดน", total_cases: 16, new_cases: 1, deaths: 0, previous_week: 3, top_age_group: "15-24 ปี" },
        { district_name: "มะนัง", total_cases: 10, new_cases: 1, deaths: 0, previous_week: 1, top_age_group: "5-9 ปี" }
    ],
    districtWeekly: [
        { district_name: "เมืองสตูล", weeks: [8, 9, 11, 12, 14, 18] },
        { district_name: "ละงู", weeks: [5, 6, 7, 8, 8, 9] },
        { district_name: "ควนกาหลง", weeks: [3, 4, 4, 5, 5, 6] },
        { district_name: "ท่าแพ", weeks: [2, 3, 4, 4, 5, 4] },
        { district_name: "ทุ่งหว้า", weeks: [1, 2, 2, 3, 2, 2] },
        { district_name: "ควนโดน", weeks: [2, 2, 3, 2, 3, 1] },
        { district_name: "มะนัง", weeks: [1, 1, 1, 2, 1, 1] }
    ],
    patientTypes: [
        { name: "ผู้ป่วยสงสัย", value: 58 },
        { name: "ผู้ป่วยเข้าข่าย", value: 74 },
        { name: "ผู้ป่วยยืนยัน", value: 122 },
        { name: "ผู้เสียชีวิต", value: 0 }
    ],
    ageSex: [
        { age_group: "0-4 ปี", male: 8, female: 6 },
        { age_group: "5-9 ปี", male: 24, female: 22 },
        { age_group: "10-14 ปี", male: 32, female: 29 },
        { age_group: "15-24 ปี", male: 25, female: 23 },
        { age_group: "25-34 ปี", male: 16, female: 14 },
        { age_group: "35-44 ปี", male: 10, female: 9 },
        { age_group: "45-54 ปี", male: 8, female: 7 },
        { age_group: "55-64 ปี", male: 5, female: 4 },
        { age_group: "65 ปีขึ้นไป", male: 6, female: 4 }
    ],
    diseaseCodes: [
        { disease_code: "A90", disease_name_th: "ไข้เดงกี", disease_name_en: "Dengue fever", cases: 178, previous_week_change: 18 },
        { disease_code: "A91", disease_name_th: "ไข้เลือดออกเดงกี", disease_name_en: "Dengue haemorrhagic fever", cases: 76, previous_week_change: 5 }
    ]
};

export function enrichDistrictOutbreakData(districtCases = diseaseOutbreakMockData.districtCases) {
    const totalCases = districtCases.reduce((sum, item) => sum + Number(item.total_cases || 0), 0);

    return districtCases.map((item) => {
        const population = satunDistrictPopulations[item.district_name] || 1;
        const total_cases = Number(item.total_cases || 0);
        const new_cases = Number(item.new_cases || 0);
        const previous_week = Number(item.previous_week || 0);
        const deaths = Number(item.deaths || 0);
        const morbidity_rate = total_cases > 0 ? (total_cases / population) * 100000 : 0;
        const case_fatality_rate = total_cases > 0 ? (deaths / total_cases) * 100 : 0;
        const trend_status = new_cases > previous_week ? "เพิ่มขึ้น" : new_cases < previous_week ? "ลดลง" : "ทรงตัว";
        const risk_level = morbidity_rate >= 65 || new_cases >= 15
            ? "ระบาด"
            : morbidity_rate >= 35 || new_cases >= 5
                ? "เฝ้าระวังสูง"
                : "เฝ้าระวัง";

        return {
            ...item,
            total_cases,
            new_cases,
            deaths,
            previous_week,
            population,
            morbidity_rate,
            mortality_rate: population > 0 ? (deaths / population) * 100000 : 0,
            case_fatality_rate,
            trend_status,
            risk_level,
            percent_of_total: totalCases > 0 ? (total_cases / totalCases) * 100 : 0
        };
    }).sort((a, b) => b.total_cases - a.total_cases);
}
