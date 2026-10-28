import fs from "node:fs";
import path from "node:path";
import { attachReceipts, deviceKind, receiptIds, receiptTotals, validateReceiptInput } from "@/lib/publicPush";
import { HOUSEKEEPING } from "@/lib/pdpaRetention.mjs";

const ROOT = process.env.STN_ROOT || process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("นับผู้รับแจ้งเตือน", () => {
  test("receiptIds keeps positive integers, unique, max 10", () => {
    expect(receiptIds([3, "4", 3, -1, 0, 1.5, "x"])).toEqual([3, 4]);
    expect(receiptIds(7)).toEqual([7]);
    expect(receiptIds(Array.from({ length: 20 }, (_, i) => i + 1))).toHaveLength(10);
  });

  test("validateReceiptInput checks event, ids and endpoint", () => {
    const allow = (url) => url.startsWith("https://fcm.googleapis.com/");
    const ok = validateReceiptInput({ ids: [5], event: "opened", endpoint: "https://fcm.googleapis.com/x" }, { isAllowedEndpoint: allow });
    expect(ok.value).toEqual({ ids: [5], event: "opened", endpoint: "https://fcm.googleapis.com/x" });
    expect(validateReceiptInput({ ids: [5], event: "clicked", endpoint: "https://fcm.googleapis.com/x" }).error).toBe("event");
    expect(validateReceiptInput({ ids: [], event: "shown", endpoint: "https://fcm.googleapis.com/x" }).error).toBe("ids");
    expect(validateReceiptInput({ ids: [5], event: "shown", endpoint: "https://evil.example/x" }, { isAllowedEndpoint: allow }).error).toBe("endpoint");
  });

  test("deviceKind groups user agents", () => {
    expect(deviceKind("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("iPhone/iPad");
    expect(deviceKind("Mozilla/5.0 (Linux; Android 14)")).toBe("Android");
    expect(deviceKind("Mozilla/5.0 (Windows NT 10.0)")).toBe("Windows");
    expect(deviceKind("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("Mac");
    expect(deviceKind("")).toBe("อื่น ๆ");
  });

  test("attachReceipts: untracked rows get null, opened counts as shown", () => {
    const rows = attachReceipts(
      [{ id: 1, delivered: 10, receipt_tracked: 1 }, { id: 2, delivered: 8, receipt_tracked: 0 }, { id: 3, delivered: 0, receipt_tracked: 1 }],
      [{ log_id: 1, event: "shown", n: 6 }, { log_id: 1, event: "opened", n: 7 }]
    );
    expect(rows[0]).toMatchObject({ tracked: true, shown: 7, opened: 7, open_rate: 70 });
    expect(rows[1]).toMatchObject({ tracked: false, shown: null, opened: null, open_rate: null });
    expect(rows[2]).toMatchObject({ tracked: true, shown: 0, opened: 0, open_rate: null });
  });

  test("receiptTotals only sums tracked alerts", () => {
    const totals = receiptTotals([
      { tracked: true, recipients: 10, delivered: 10, shown: 8, opened: 2 },
      { tracked: false, recipients: 50, delivered: 50, shown: null, opened: null }
    ]);
    expect(totals).toMatchObject({ alerts: 2, tracked_alerts: 1, delivered: 10, shown: 8, opened: 2, shown_rate: 80, open_rate: 20 });
    expect(receiptTotals([]).open_rate).toBeNull();
  });

  test("receipts are purged by housekeeping", () => {
    expect(HOUSEKEEPING.map(([, sql]) => sql).join(" ")).toMatch(/DELETE FROM push_receipts/);
  });

  test("service worker reports shown and opened with the log ids", () => {
    const sw = read("public/sw.js");
    expect(sw).toMatch(/api\/public\/push\/receipt\//);
    expect(sw).toMatch(/sendReceipt\(rid, "shown"\)/);
    expect(sw).toMatch(/sendReceipt\(info\.rid, "opened"\)/);
    expect(sw).toMatch(/rid\s*}/); // เก็บรหัสไว้ใน notification.data เพื่อใช้ตอนกด
  });

  test("migration is listed in the manifest", () => {
    expect(JSON.parse(read("migrations/manifest.json")).migrations).toContain("20261024_push_receipts.sql");
    expect(read("migrations/20261024_push_receipts.sql")).toMatch(/CREATE TABLE IF NOT EXISTS push_receipts/);
  });

  test("subscribe prompt is mounted on public shells, and home opts out of the duplicate", () => {
    expect(read("components/public/PublicOpsScaffold.jsx")).toMatch(/<AlertSubscribePrompt \/>/);
    expect(read("components/layouts/PublicLayout.jsx")).toMatch(/<AlertSubscribePrompt \/>/);
    expect(read("components/public/home/PublicHome.jsx")).toMatch(/alertPrompt=\{false\}/);
  });
});

test("หน้าแจ้งเตือนประชาชน: สถิติพังไม่ทำให้การตั้งค่าหายทั้งหน้า", () => {
  const route = read("app/api/admin/public-push/route.js");
  expect(route).toMatch(/stats_error/);
  expect(read("components/admin/settings/PublicPushSettings.jsx")).toMatch(/state\.data\.stats_error/);
});
