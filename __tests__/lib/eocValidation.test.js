const {
  canCalculateRate,
  parsePositiveInteger,
  validateMissionInput,
  validateMissionTransition,
  validatePopulationInput,
} = require("@/lib/eocValidation");

describe("officer data validation", () => {
  test("population total is always calculated from male plus female", () => {
    const result = validatePopulationInput({
      province_code: "91",
      district_name: "เมืองสตูล",
      male_population: 100,
      female_population: 120,
      population_scope: "thai",
      population_year: 2025,
      source_name: "ทะเบียนราษฎร",
    });
    expect(result).toMatchObject({ ok: true, value: { population: 220 } });
  });

  test("rejects negative population values", () => {
    expect(validatePopulationInput({
      province_code: "91",
      district_name: "เมืองสตูล",
      male_population: -1,
      female_population: 120,
      population_scope: "thai",
      source_name: "ทะเบียนราษฎร",
    }).ok).toBe(false);
  });

  test("does not calculate per-100k rate without a denominator", () => {
    expect(canCalculateRate({ numerator: 10, population: 0, numeratorScope: "thai", populationScope: "thai" }))
      .toMatchObject({ ok: false, warning: expect.stringContaining("ไม่มีประชากร") });
  });

  test("warns when population and numerator scopes differ", () => {
    expect(canCalculateRate({ numerator: 10, population: 1000, numeratorScope: "all", populationScope: "thai" }))
      .toMatchObject({ ok: false, warning: expect.stringContaining("ขอบเขตประชากรไม่ตรง") });
  });

  test("enforces mission transition order", () => {
    expect(validateMissionTransition("intake", "assigned")).toBe(true);
    expect(validateMissionTransition("intake", "closed")).toBe(false);
    expect(validateMissionTransition("completed", "verified")).toBe(true);
  });

  test("keeps mission progress within 0-100", () => {
    expect(validateMissionInput({ mission_code: "M-1", mission_type: "field", mission_name: "สำรวจ", progress_percent: 100 }).ok).toBe(true);
    expect(validateMissionInput({ mission_code: "M-1", mission_type: "field", mission_name: "สำรวจ", progress_percent: 101 }).ok).toBe(false);
  });

  test("accepts positive IDs only", () => {
    expect(parsePositiveInteger("5")).toBe(5);
    expect(parsePositiveInteger("0")).toBeNull();
    expect(parsePositiveInteger("5.5")).toBeNull();
  });
});

