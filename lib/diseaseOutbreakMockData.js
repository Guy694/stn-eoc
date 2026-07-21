export const satunDistrictPopulations = {
    "เมืองสตูล": 116400,
    "ควนโดน": 23300,
    "ควนกาหลง": 43800,
    "ท่าแพ": 29900,
    "ละงู": 76000,
    "ทุ่งหว้า": 26500,
    "มะนัง": 19900
};

export function enrichDistrictOutbreakData(districtCases = []) {
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
