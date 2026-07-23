const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const DEFAULT_FILE = path.join(process.cwd(), "prompter", "ประชากร.csv");

function parseCsvLine(line) {
    const cells = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (character === '"') {
            if (quoted && line[index + 1] === '"') {
                value += '"';
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else if (character === "," && !quoted) {
            cells.push(value.trim());
            value = "";
        } else {
            value += character;
        }
    }
    cells.push(value.trim());
    return cells;
}

function parsePopulation(value, label, districtName) {
    const normalized = String(value || "").replaceAll(",", "").trim();
    if (!/^\d+$/.test(normalized)) {
        throw new Error(`INVALID_${label.toUpperCase()}:${districtName}`);
    }
    return Number(normalized);
}

function readRows(filePath) {
    const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    const header = parseCsvLine(lines.shift()).filter(Boolean);
    const expected = ["พื้นที่", "ชาย(ไทย)", "หญิง(ไทย)", "รวม(ไทย)"];
    if (header.join("|") !== expected.join("|")) {
        throw new Error(`UNEXPECTED_HEADERS:${header.join("|")}`);
    }

    const seen = new Set();
    return lines.map((line) => {
        const [rawDistrict, rawMale, rawFemale, rawTotal] = parseCsvLine(line);
        const districtName = String(rawDistrict || "").replace(/^อำเภอ/, "").trim();
        if (!districtName || seen.has(districtName)) throw new Error(`INVALID_OR_DUPLICATE_DISTRICT:${districtName}`);
        seen.add(districtName);
        const male = parsePopulation(rawMale, "male", districtName);
        const female = parsePopulation(rawFemale, "female", districtName);
        const total = parsePopulation(rawTotal, "total", districtName);
        if (male + female !== total) throw new Error(`TOTAL_MISMATCH:${districtName}`);
        return { districtName, male, female, total };
    });
}

async function main() {
    const filePath = path.resolve(process.argv[2] || DEFAULT_FILE);
    const rows = readRows(filePath);
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "stneoc",
        charset: "utf8mb4"
    });

    try {
        const [areaRows] = await connection.query(`
            SELECT DISTINCT distname AS district_name
            FROM satun_village_polygon
        `);
        const validDistricts = new Set(areaRows.map((row) => row.district_name));
        const unknown = rows.filter((row) => !validDistricts.has(row.districtName));
        if (unknown.length) throw new Error(`UNKNOWN_DISTRICTS:${unknown.map((row) => row.districtName).join(",")}`);

        await connection.beginTransaction();
        for (const row of rows) {
            await connection.execute(`
                INSERT INTO area_population
                  (province_code, district_code, district_name, male_population,
                   female_population, population, population_year, population_scope,
                   source_name, source_updated_at)
                VALUES ('91', NULL, ?, ?, ?, ?, NULL, 'thai', ?, NOW())
                ON DUPLICATE KEY UPDATE
                  male_population = VALUES(male_population),
                  female_population = VALUES(female_population),
                  population = VALUES(population),
                  population_year = VALUES(population_year),
                  source_updated_at = VALUES(source_updated_at),
                  updated_at = CURRENT_TIMESTAMP
            `, [row.districtName, row.male, row.female, row.total, path.basename(filePath)]);
        }
        await connection.commit();
        const totals = rows.reduce((result, row) => ({
            male: result.male + row.male,
            female: result.female + row.female,
            total: result.total + row.total
        }), { male: 0, female: 0, total: 0 });
        process.stdout.write(JSON.stringify({ imported: rows.length, scope: "thai", population_year: null, totals }));
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        await connection.end();
    }
}

main().catch((error) => {
    process.stderr.write(error.message);
    process.exit(1);
});
