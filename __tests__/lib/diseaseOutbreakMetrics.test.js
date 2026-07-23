const { enrichDistrictOutbreakData } = require("@/lib/diseaseOutbreakMetrics");

describe("disease outbreak metrics", () => {
    test("does not invent a denominator when population is absent", () => {
        const [row] = enrichDistrictOutbreakData([{
            district_name: "เมืองสตูล",
            total_cases: 10,
            new_cases: 2,
            previous_week: 1,
            deaths: null,
            population: null
        }]);

        expect(row.population).toBeNull();
        expect(row.morbidity_rate).toBeNull();
        expect(row.mortality_rate).toBeNull();
        expect(row.case_fatality_rate).toBeNull();
        expect(row.data_quality_warning).toContain("ไม่มีข้อมูลประชากร");
    });

    test("calculates rates only from database-provided population", () => {
        const [row] = enrichDistrictOutbreakData([{
            district_name: "เมืองสตูล",
            total_cases: 20,
            new_cases: 4,
            previous_week: 3,
            deaths: 1,
            population: 100000
        }]);

        expect(row.morbidity_rate).toBe(20);
        expect(row.mortality_rate).toBe(1);
        expect(row.case_fatality_rate).toBe(5);
        expect(row.data_quality_warning).toBeNull();
    });
});
