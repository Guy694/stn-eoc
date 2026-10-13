/** @jest-environment node */
// แผนที่โรคใช้ทั้งหน้าเจ้าหน้าที่และหน้าสาธารณะ — สาธารณะต้องไม่ได้หมายเหตุหรือพิกัดบ้านผู้ป่วย
const mockSql = [];
let mockOfficer = false;

jest.mock("@/lib/auth", () => ({ getAuthSession: jest.fn(async () => ({ success: mockOfficer })) }));
jest.mock("@/lib/db", () => ({
  getPool: () => ({
    getConnection: async () => ({
      release: () => {},
      execute: async (sql) => {
        mockSql.push(sql);
        if (/INFORMATION_SCHEMA/.test(sql)) return [[{ COLUMN_NAME: "disease_id" }, { COLUMN_NAME: "disease_name" }]];
        if (/FROM eoc_sessions/.test(sql)) return [[{ id: 4, session_number: 1, opened_at: "2026-10-01", status: "active" }]];
        return [[{ id: 1, disease_name: "ไข้เลือดออก", patient_count: 2, district: "ละงู", tambon: "กำแพง", notes: null, lat: 6.9, lng: 99.8 }]];
      }
    })
  })
}));

const { GET } = require("@/app/api/eoc/disease/area-status/route");
const request = () => new Request("http://localhost/stn-eoc/api/eoc/disease/area-status?session_id=4");
const reportSql = () => mockSql.find((sql) => /FROM disease_reports/.test(sql));

beforeEach(() => { mockSql.length = 0; });

test("สาธารณะ: ไม่ดึงหมายเหตุ ไม่ใช้พิกัดบ้าน (ทั้ง SELECT และ GROUP BY)", async () => {
  mockOfficer = false;
  const json = await (await GET(request())).json();
  expect(json.detail).toBe("public");
  expect(reportSql()).not.toMatch(/home_lat|home_lng|dr\.notes/);
  expect(reportSql()).toMatch(/NULL as notes/);
});

test("เจ้าหน้าที่ที่เข้าสู่ระบบ: ได้หมายเหตุและจุดบ้าน (ถ้ามีพิกัด)", async () => {
  mockOfficer = true;
  const response = await GET(request());
  expect((await response.json()).detail).toBe("officer");
  expect(response.headers.get("cache-control")).toContain("private");
  expect(reportSql()).toMatch(/dr\.home_lat/);
  expect(reportSql()).toMatch(/GROUP_CONCAT\(DISTINCT dr\.notes/);
});
