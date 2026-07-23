const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { buildQualitySummary, evaluatePopulationRow, inspectFileAsset, resolveManagedStoragePath } = require("@/lib/dataQuality");

describe("data quality rules", () => {
  test("detects population total, source, year, and scope issues", () => {
    expect(evaluatePopulationRow({
      male_population: 10,
      female_population: 20,
      population: 99,
      population_scope: "",
      source_name: "",
      population_year: null,
    })).toEqual(expect.arrayContaining([
      "population_total_mismatch",
      "population_scope_missing",
      "source_name_missing",
      "population_year_missing",
    ]));
  });

  test("accepts a consistent population record", () => {
    expect(evaluatePopulationRow({
      male_population: 10,
      female_population: 20,
      population: 30,
      population_scope: "thai",
      source_name: "ทะเบียนราษฎร",
      population_year: 2025,
    })).toEqual([]);
  });

  test("blocks traversal outside managed public storage", () => {
    expect(resolveManagedStoragePath("../../etc/passwd", "/workspace")).toBeNull();
    expect(resolveManagedStoragePath("/uploads/eoc/report.pdf", "/workspace")).toBe("/workspace/public/uploads/eoc/report.pdf");
  });

  test("groups issue counts for dashboard cards", () => {
    expect(buildQualitySummary([{ issue_type: "missing" }, { issue_type: "missing" }, { issue_type: "duplicate" }]))
      .toEqual({ total: 3, by_type: { missing: 2, duplicate: 1 } });
  });

  test("reports a checksum mismatch for a managed file", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "stneoc-quality-"));
    try {
      const file = path.join(root, "public", "uploads", "eoc", "report.txt");
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, "real content");
      await expect(inspectFileAsset({
        id: 1,
        storage_path: "uploads/eoc/report.txt",
        file_size: 12,
        checksum_sha256: "0".repeat(64),
      }, root)).resolves.toMatchObject({ issue: "checksum_mismatch" });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
