export function enrichDistrictOutbreakData(districtCases = []) {
    const totalCases = districtCases.reduce((sum, item) => sum + Number(item.total_cases || 0), 0);

    return districtCases
        .map((item) => {
            const population = Number(item.population);
            const hasPopulation = Number.isFinite(population) && population > 0;
            const total_cases = Number(item.total_cases || 0);
            const new_cases = Number(item.new_cases || 0);
            const previous_week = Number(item.previous_week || 0);
            const deaths = item.deaths === null || item.deaths === undefined ? null : Number(item.deaths);
            const morbidity_rate = hasPopulation ? (total_cases / population) * 100000 : null;
            const mortality_rate = hasPopulation && deaths !== null ? (deaths / population) * 100000 : null;
            const case_fatality_rate = total_cases > 0 && deaths !== null ? (deaths / total_cases) * 100 : null;
            const trend_status = new_cases > previous_week ? "เพิ่มขึ้น" : new_cases < previous_week ? "ลดลง" : "ทรงตัว";

            return {
                ...item,
                total_cases,
                new_cases,
                deaths,
                previous_week,
                population: hasPopulation ? population : null,
                morbidity_rate,
                mortality_rate,
                case_fatality_rate,
                trend_status,
                percent_of_total: totalCases > 0 ? (total_cases / totalCases) * 100 : 0,
                data_quality_warning: hasPopulation
                    ? item.data_quality_warning || null
                    : "ไม่มีข้อมูลประชากรในฐานข้อมูล จึงไม่คำนวณอัตราต่อแสนประชากร"
            };
        })
        .sort((a, b) => b.total_cases - a.total_cases);
}
