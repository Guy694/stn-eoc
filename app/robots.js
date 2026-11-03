import { getSiteUrl } from "@/lib/siteUrl";
import { AI_ROBOTS_TOKENS } from "@/lib/aiBots";

// บอทค้นหาทั่วไป (Google, Bing) อ่านหน้าประชาชนได้ เพื่อให้ประชาชนค้นเว็บเจอช่วงเกิดภัย
// บอท AI (เก็บข้อมูลฝึกโมเดล / อ่านแทนผู้ใช้) ห้ามทั้งเว็บ — รายชื่อใน lib/aiBots.js (proxy.js ตอบ 403 ให้ด้วย)
export default function robots() {
  return {
    rules: [
      {
        userAgent: AI_ROBOTS_TOKENS,
        disallow: ["/"]
      },
      {
        userAgent: "*",
        allow: ["/", "/public/", "/privacy-policy"],
        disallow: ["/api/", "/admin/", "/dashboard/", "/eoc/", "/settings/", "/profile/", "/login/", "/register/"]
      }
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`
  };
}
