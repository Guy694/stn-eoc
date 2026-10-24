import { formatWatchdogMessage, nextWatchdogState, durationText, watchdogConfig } from "../../scripts/uptime-watchdog.mjs";
import { summarizeAudit, formatAuditMessage } from "../../scripts/audit-report.mjs";

const cfg = { failuresBeforeAlert: 3, remindMs: 30 * 60e3 };
const fail = { ok: false, reason: "HTTP 503" };

test("watchdog: แจ้งล่มเมื่อผิด 3 ครั้งติด เตือนซ้ำทุก 30 นาที และแจ้งเมื่อกลับมา", () => {
  let state;
  let out = nextWatchdogState(state, fail, 0, cfg); state = out.state; expect(out.notify).toBeNull();
  out = nextWatchdogState(state, fail, 60e3, cfg); state = out.state; expect(out.notify).toBeNull();
  out = nextWatchdogState(state, fail, 120e3, cfg); state = out.state;
  expect(out.notify).toMatchObject({ kind: "down", since: 0, failures: 3 });
  out = nextWatchdogState(state, fail, 180e3, cfg); state = out.state; expect(out.notify).toBeNull();
  out = nextWatchdogState(state, fail, 120e3 + 30 * 60e3, cfg); state = out.state; expect(out.notify?.kind).toBe("still_down");
  out = nextWatchdogState(state, { ok: true }, 40 * 60e3, cfg);
  expect(out.notify).toMatchObject({ kind: "up", since: 0 });
  expect(out.state.down).toBe(false);
});

test("watchdog: ผิดครั้งเดียวแล้วกลับมา ไม่แจ้ง", () => {
  const first = nextWatchdogState(undefined, fail, 0, cfg);
  expect(nextWatchdogState(first.state, { ok: true }, 60e3, cfg).notify).toBeNull();
});

test("watchdog: ข้อความและค่าตั้ง", () => {
  expect(durationText(12 * 60e3)).toBe("12 นาที");
  expect(durationText(135 * 60e3)).toBe("2 ชม. 15 นาที");
  const text = formatWatchdogMessage("up", { name: "แอป", url: "http://app/health", since: 0, now: 12 * 60e3 });
  expect(text).toMatch(/กลับมาใช้งานได้แล้ว/);
  expect(text).toMatch(/ล่มนาน 12 นาที/);
  const c = watchdogConfig({ WATCHDOG_PUBLIC_URL: "https://example.test/stn-eoc/api/health/", TELEGRAM_SECURITY_CHAT_IDS: "1, 2" });
  expect(c.targets).toHaveLength(2);
  expect(c.chatIds).toEqual(["1", "2"]);
});

test("audit report: นับระดับและเลือกเฉพาะสูง/วิกฤต", () => {
  const summary = summarizeAudit({
    metadata: { vulnerabilities: { critical: 1, high: 0, moderate: 2, low: 0 } },
    vulnerabilities: {
      next: { name: "next", severity: "critical", via: [{ title: "RCE <test>", url: "https://example.test" }], fixAvailable: { name: "next", version: "16.9.9", isSemVerMajor: false } },
      foo: { name: "foo", severity: "moderate", via: ["bar"], fixAvailable: true }
    }
  });
  expect(summary.counts).toEqual({ critical: 1, high: 0, moderate: 2, low: 0 });
  expect(summary.items).toHaveLength(1);
  const text = formatAuditMessage(summary, { repo: "owner/repo" });
  expect(text).toMatch(/วิกฤต 1 · สูง 0 · ปานกลาง 2/);
  expect(text).toMatch(/อัปเกรด next เป็น 16\.9\.9/);
  expect(text).toContain("RCE &lt;test&gt;");
});
