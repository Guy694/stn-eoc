import { Droplets, Ellipsis, Mountain, RouteOff, TreePine, ZapOff } from "lucide-react";

// ไอคอนและสีของหมวดจุดปัญหา (ใช้ทั้งฟอร์มประชาชน หน้าตรวจของเจ้าหน้าที่ และแผนที่)
export const PROBLEM_CATEGORY_STYLE = {
  flood: { icon: Droplets, color: "#1d6fb8", bg: "#e6f1fb" },
  road_cut: { icon: RouteOff, color: "#b42318", bg: "#fdecea" },
  power_out: { icon: ZapOff, color: "#9a6700", bg: "#fff4d6" },
  tree_down: { icon: TreePine, color: "#2f6b3a", bg: "#e8f3ea" },
  landslide: { icon: Mountain, color: "#7a4b1e", bg: "#f6ece2" },
  other: { icon: Ellipsis, color: "#475467", bg: "#eef1f4" }
};

export function problemStyle(category) {
  return PROBLEM_CATEGORY_STYLE[category] || PROBLEM_CATEGORY_STYLE.other;
}
