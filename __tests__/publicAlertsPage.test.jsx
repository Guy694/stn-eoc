import { render, screen } from "@testing-library/react";
import PublicAlertsPage from "@/app/admin/public-alerts/page";

let mockUser = { role: "admin" };
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: mockUser, loading: false }) }));
jest.mock("@/components/layouts/EOCLayout", () => ({ __esModule: true, default: ({ children }) => <div>{children}</div> }));
jest.mock("@/components/admin/settings/PublicPushSettings", () => ({ __esModule: true, default: () => <div>push-settings</div> }));
jest.mock("@/components/admin/settings/AlertSoundSettings", () => ({ __esModule: true, default: () => <div>sound-settings</div> }));

describe("หน้าแจ้งเตือนประชาชน", () => {
  test("ผู้ดูแลระบบเห็นส่วนเปลี่ยนเสียงแจ้งเตือนและปุ่มลัด", () => {
    mockUser = { role: "admin" };
    render(<PublicAlertsPage />);
    expect(screen.getByText("sound-settings")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /เปลี่ยนเสียงแจ้งเตือน/ })).toHaveAttribute("href", "#alert-sounds");
  });

  test("ผู้บัญชาการเหตุการณ์ไม่เห็นส่วนเปลี่ยนเสียง", () => {
    mockUser = { role: "commander" };
    render(<PublicAlertsPage />);
    expect(screen.getByText("push-settings")).toBeInTheDocument();
    expect(screen.queryByText("sound-settings")).toBeNull();
    expect(screen.getByText(/เปลี่ยนได้เฉพาะผู้ดูแลระบบ/)).toBeInTheDocument();
  });
});
