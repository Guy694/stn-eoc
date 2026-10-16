import { render, screen } from "@testing-library/react";
import PublicBottomBar from "@/components/public/PublicBottomBar";
import { bottomBarKey } from "@/components/public/PublicTopNavigation";

jest.mock("next/navigation", () => ({ usePathname: () => "/public/track" }));
jest.mock("@/components/public/useHelpAvailability", () => ({
  __esModule: true,
  default: () => ({ helpOpen: true, floodOpen: true, sheltersOpen: true }),
  HELP_CLOSED_HINT: "ปิด",
  WATER_CLOSED_HINT: "ปิด"
}));

describe("PublicBottomBar", () => {
  it("หน้าที่อยู่ในแถบล่างได้ key ของตัวเอง (รองรับ basePath และ / ท้าย)", () => {
    expect(bottomBarKey("/public/report-water/")).toBe("water");
    expect(bottomBarKey("/stn-eoc/public/my-risk")).toBe("myrisk");
    expect(bottomBarKey("/public/report-incident")).toBe("help");
    expect(bottomBarKey("/public/track/")).toBe("track");
    expect(bottomBarKey("/public/shelters")).toBe("shelters");
    expect(bottomBarKey("/public/weather-watch")).toBeNull();
    expect(bottomBarKey("/")).toBeNull();
  });

  it("ไฮไลต์หน้าปัจจุบันด้วย aria-current และเว้นที่ท้ายหน้าเมื่อแสดงตลอด", () => {
    const { unmount } = render(<PublicBottomBar visible activeMenu="track" reserveSpace />);
    expect(screen.getByRole("link", { name: /ติดตาม/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /บ้านฉัน/ })).not.toHaveAttribute("aria-current");
    expect(document.documentElement.dataset.bottomBar).toBe("on");
    expect(document.documentElement.dataset.bottomBarSpace).toBe("on");
    unmount();
    expect(document.documentElement.dataset.bottomBar).toBeUndefined();
  });

  it("หน้าขอความช่วยเหลือ/รายงานระดับน้ำ ไฮไลต์ปุ่มของตัวเอง", () => {
    render(<PublicBottomBar visible activeMenu="water" />);
    expect(screen.getByRole("link", { name: /ระดับน้ำ/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /ช่วยเหลือ/ })).not.toHaveAttribute("aria-current");
  });
});
