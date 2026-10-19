import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import OfficerWorkspace from "@/components/admin/officers/OfficerWorkspace";

jest.mock("@/lib/sweetAlert", () => ({ showDeleteConfirm: jest.fn(async () => true), showConfirm: jest.fn(async () => true) }));
// ผลการทำงานแสดงเป็น toast มุมขวาบน (lib/notify) — ตรวจจากการเรียก notify
jest.mock("@/lib/notify", () => {
  const notify = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
  return { __esModule: true, notify, default: notify };
});
const { notify } = require("@/lib/notify");
const toasted = (pattern) => waitFor(() => expect([...notify.error.mock.calls, ...notify.warning.mock.calls, ...notify.success.mock.calls].some(([text]) => pattern.test(String(text)))).toBe(true));

const officer = { id: 331, username: "eoc2569_008", title: "นางสาว", given_name: "นุสรีย์", family_name: "ปะดุกา", email: "", phone: "", role: "staff", is_approved: 1, created_at: "2026-10-01T00:00:00Z" };
const teams = [
  { session_team_id: 11, session_id: 1, eoc_type: "flood", session_number: 3, team_code: "LOGISTICS", team_name_th: "สำรองวัสดุ" },
  { session_team_id: 12, session_id: 1, eoc_type: "flood", session_number: 3, team_code: "SAT", team_name_th: "ตระหนักรู้สถานการณ์" }
];

function respond(body, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body });
}

function setup({ assignmentsPut = { success: true }, assignments = [{ session_team_id: 11, role_in_team: "สมาชิก" }, { session_team_id: 99, role_in_team: "หัวหน้าทีม" }] } = {}) {
  const calls = [];
  global.fetch = jest.fn((url, init = {}) => {
    calls.push({ url, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
    if (url.includes("/registrations")) return respond({ success: true, data: [], stats: {} });
    if (url.includes("/team-assignments")) {
      if (init.method === "PUT") return respond(assignmentsPut, assignmentsPut.success ? 200 : 400);
      return respond({ success: true, availableTeams: teams, assignments });
    }
    if (url.includes("/officers/331")) return respond({ success: true, data: officer });
    return respond({ success: true, data: [officer], stats: { staff: 1 } });
  });
  render(<OfficerWorkspace />);
  return calls;
}

async function openEdit() {
  const [button] = await screen.findAllByRole("button", { name: /แก้ไข/ });
  fireEvent.click(button);
  await screen.findByText("LOGISTICS");
}

describe("OfficerWorkspace", () => {
  it("แปลงบทบาทเก่า ส่งเฉพาะทีมที่เปิดอยู่ และบันทึกได้", async () => {
    const calls = setup();
    await openEdit();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getAllByRole("checkbox").find((box) => box.closest("li")?.textContent.includes("SAT")));
    fireEvent.click(within(dialog).getAllByRole("radio", { name: "หัวหน้าทีม" })[1]);
    fireEvent.click(within(dialog).getByRole("button", { name: "บันทึกการแก้ไข" }));
    await waitFor(() => expect(calls.some((call) => call.method === "PUT" && call.url.includes("team-assignments"))).toBe(true));
    const officerPut = calls.find((call) => call.method === "PUT" && /officers\/331\/?$/.test(call.url));
    expect(officerPut.body).not.toHaveProperty("password");
    const teamPut = calls.find((call) => call.method === "PUT" && call.url.includes("team-assignments"));
    expect(teamPut.body.assignments).toEqual([
      { sessionTeamId: 11, roleInTeam: "สมาชิกทีม" },
      { sessionTeamId: 12, roleInTeam: "หัวหน้าทีม" }
    ]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("ถ้าบันทึกกลุ่มภารกิจไม่ผ่าน บอกชัดว่าข้อมูลเจ้าหน้าที่บันทึกแล้ว", async () => {
    setup({ assignmentsPut: { success: false, message: "เลือกกลุ่มภารกิจที่ปิดแล้ว" } });
    await openEdit();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "บันทึกการแก้ไข" }));
    await toasted(/บันทึกข้อมูลเจ้าหน้าที่แล้ว แต่บันทึกกลุ่มภารกิจไม่สำเร็จ/);
  });

  it("ตรวจรหัสผ่านใหม่ก่อนส่ง", async () => {
    const calls = setup();
    await openEdit();
    const dialog = screen.getByRole("dialog");
    fireEvent.change(dialog.querySelector('input[type="password"]'), { target: { value: "short1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "บันทึกการแก้ไข" }));
    await toasted(/อย่างน้อย 10 ตัวอักษร/);
    expect(screen.getByRole("dialog")).toBeTruthy(); // dialog ยังเปิดให้แก้ต่อ
    expect(calls.some((call) => call.method === "PUT")).toBe(false);
  });
});

describe("OfficerWorkspace คำขอรออนุมัติ", () => {
  const pending = { id: 500, username: "skyline", title: "นาย", given_name: "ชาคริต", family_name: "ทองนวล", requested_role: "staff", role: "staff", agency: "สสจ.สตูล", thaiid_verified: true, rejected: false, requested_at: "2026-10-16T02:00:00Z" };
  const rejectedRow = { ...pending, id: 501, username: "old_user", rejected: true };

  function setupQueue() {
    const calls = [];
    window.history.replaceState(null, "", "/?tab=requests");
    global.fetch = jest.fn((url, init = {}) => {
      calls.push({ url, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
      if (url.includes("/registrations")) {
        if (init.method === "PATCH") return respond({ success: true, message: "ปฏิเสธคำขอแล้ว" });
        return respond({ success: true, data: [pending, rejectedRow], stats: { waiting: 1, verified: 1, rejected: 1, actionable: 1 } });
      }
      if (init.method === "PUT") return respond({ success: true, data: {} });
      return respond({ success: true, data: [officer], stats: { staff: 1 } });
    });
    render(<OfficerWorkspace />);
    return calls;
  }

  afterEach(() => window.history.replaceState(null, "", "/"));

  it("แสดงเฉพาะคนที่ยังไม่อนุมัติ พร้อมสถานะ ThaiD และอนุมัติตามสิทธิ์ที่เลือก", async () => {
    const calls = setupQueue();
    expect(await screen.findByText("ยืนยัน ThaiD แล้ว")).toBeTruthy();
    expect(screen.getByText(/คำขอที่ปฏิเสธแล้ว \(1\)/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("อนุมัติเป็น"), { target: { value: "LOGISTICS" } });
    fireEvent.click(screen.getByRole("button", { name: /^อนุมัติ$/ }));
    await waitFor(() => expect(calls.some((call) => call.method === "PUT" && /officers\/500\/?$/.test(call.url))).toBe(true));
    expect(calls.find((call) => call.method === "PUT").body).toEqual({ role: "LOGISTICS", requested_role: "LOGISTICS", is_approved: 1 });
  });

  it("ปฏิเสธต้องมีเหตุผล แล้วส่ง PATCH", async () => {
    const calls = setupQueue();
    fireEvent.click(await screen.findByRole("button", { name: /ปฏิเสธ$/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "ลงทะเบียนซ้ำ" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ปฏิเสธคำขอ" }));
    await waitFor(() => expect(calls.some((call) => call.method === "PATCH")).toBe(true));
    expect(calls.find((call) => call.method === "PATCH").body).toEqual({ officer_id: 500, action: "reject", reason: "ลงทะเบียนซ้ำ" });
  });
});
