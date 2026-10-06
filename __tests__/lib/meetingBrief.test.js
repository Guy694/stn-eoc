import { buildAgenda } from "@/lib/meetingBrief";

describe("meetingBrief", () => {
  it("merges module alerts by urgency", () => {
    const agenda = buildAgenda({
      health: { actions: [{ level: "critical", title: "มีผู้เสียชีวิต 1 ราย", detail: "x" }, { level: "info", title: "ยังไม่มีรายงานผู้ป่วยในเหตุการณ์นี้", detail: "" }] },
      shelters: { full: 1, nearFull: 2, stale: 0, free: 10 },
      supplies: { opened: true, summary: { out: 1, low: 1 }, critical: [{ level: "out", item_name: "ORS", agency_name: "รพ.ละงู", balance_qty: 0 }, { level: "low", item_name: "พารา", balance_qty: 5, unit: "แผง" }] },
      vulnerable: { pending: 4, caredPercent: 50, urgent: [{ village: "บ้านA", bedridden: 1 }] },
      it: { summary: { critical: 1 }, openTickets: [{ severity: "critical", title: "เน็ตล่ม", unit_name: "สสจ." }], offline: [{ unit_name: "สสอ.ท่าแพ" }] },
      directives: { open: 3, date: "2026-10-06" },
      completeness: { total: 10, reported: 4, percent: 40, districts: [{ district: "ละงู", missing: ["กำแพง"] }] }
    });
    expect(agenda[0]).toMatchObject({ level: "critical", module: "สุขภาพ" });
    expect(agenda.map((item) => item.title)).not.toContain("ยังไม่มีรายงานผู้ป่วยในเหตุการณ์นี้");
    const titles = agenda.map((item) => item.title);
    expect(titles).toEqual(expect.arrayContaining([
      "ศูนย์เต็ม/เกินความจุ 1 แห่ง", "เวชภัณฑ์หมดคลัง 1 รายการ", "กลุ่มเปราะบางยังไม่ได้ดูแล 4 คน",
      "ปัญหา IT ระดับวิกฤต/สูงที่ยังเปิด 1 เรื่อง", "ข้อสั่งการที่ยังไม่ดำเนินการ 3 ข้อ", "ส่งรายงานวันนี้แล้ว 40% (4/10 ตำบล)"
    ]));
    expect(agenda.find((item) => item.module === "กลุ่มเปราะบาง").level).toBe("serious");
    const levels = agenda.map((item) => item.level);
    expect(levels).toEqual([...levels].sort((a, b) => ["critical", "serious", "warning", "info"].indexOf(a) - ["critical", "serious", "warning", "info"].indexOf(b)));
  });

  it("suggests opening the stock ledger when missing", () => {
    expect(buildAgenda({ supplies: { opened: false } })[0].title).toContain("บัญชีคลัง");
  });
});

describe("buildAgenda — รายงานจากประชาชน", () => {
  it("เตือนคำขอความช่วยเหลือที่ค้าง และจุดปัญหาที่รอตรวจนาน", () => {
    const items = buildAgenda({ citizen: { pendingHelp: 2, oldestHelpMinutes: 45, pendingPoints: 3, oldestPointMinutes: 90, published: 4, flaggedNormal: 1 } });
    const titles = items.map((item) => item.title);
    expect(items[0]).toMatchObject({ level: "critical", href: "/admin/incident-reports?status=pending" });
    expect(items[0].detail).toBe("รอนานสุด 45 นาที");
    expect(titles).toContain("จุดปัญหาจากประชาชนรอตรวจ 3 เรื่อง");
    expect(titles).toContain("ประชาชนแจ้งว่าปกติแล้ว 1 จุด");
  });
  it("ไม่เตือนจุดปัญหาที่เพิ่งเข้ามาไม่ถึง 30 นาที", () => {
    const items = buildAgenda({ citizen: { pendingHelp: 0, pendingPoints: 2, oldestPointMinutes: 10, flaggedNormal: 0 } });
    expect(items).toHaveLength(0);
  });
});
