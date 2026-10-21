/** @jest-environment node */
jest.mock("@/lib/db", () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock("fs/promises", () => ({ __esModule: true, default: { readFile: jest.fn() }, readFile: jest.fn() }));
import fs from "fs/promises";
import { query } from "@/lib/db";
import { GET as gallery } from "@/app/api/public/infographic-gallery/route";
import { GET as serve } from "@/app/infographics/[type]/[file]/route";
import { infographicTitle } from "@/lib/infographicAssets";

describe("คลังอินโฟกราฟิกฝั่งประชาชน", () => {
  test("ชื่อภาพมาจากชื่อไฟล์เดิม", () => {
    expect(infographicTitle("[ทดสอบ]_ระวัง_ไฟฟ้าดูด.png")).toBe("[ทดสอบ] ระวัง ไฟฟ้าดูด");
    expect(infographicTitle("")).toBe("อินโฟกราฟิก");
  });

  test("รายการภาพส่งเฉพาะข้อมูลที่ต้องใช้ และข้ามประเภทที่ไม่รู้จัก", async () => {
    query.mockResolvedValueOnce([
      { id: 2, eoc_type: "flood", stored_filename: "a.png", original_filename: "[ทดสอบ] น้ำท่วม.png", created_at: "2026-10-20" },
      { id: 1, eoc_type: "other", stored_filename: "b.png", original_filename: "x.png", created_at: "2026-10-20" }
    ]);
    const json = await (await gallery()).json();
    expect(json.data).toEqual([{ id: 2, eoc_type: "flood", title: "[ทดสอบ] น้ำท่วม", image: "/stn-eoc/infographics/flood/a.png", created_at: "2026-10-20" }]);
  });

  test("ส่งไฟล์ภาพที่อัปโหลดหลังเปิดเซิร์ฟเวอร์ได้ และกันชื่อไฟล์อันตราย", async () => {
    fs.readFile.mockResolvedValueOnce(Buffer.from("png"));
    const ok = await serve(new Request("http://x/"), { params: Promise.resolve({ type: "flood", file: "a1.png" }) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    const bad = await serve(new Request("http://x/"), { params: Promise.resolve({ type: "flood", file: "..%2Fsecret.png" }) });
    expect(bad.status).toBe(404);
    const wrongType = await serve(new Request("http://x/"), { params: Promise.resolve({ type: "uploads", file: "a.png" }) });
    expect(wrongType.status).toBe(404);
    const notImage = await serve(new Request("http://x/"), { params: Promise.resolve({ type: "flood", file: "a.svg" }) });
    expect(notImage.status).toBe(404);
  });
});
