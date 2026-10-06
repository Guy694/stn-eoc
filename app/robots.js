import { getSiteUrl } from "@/lib/siteUrl";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/public/", "/privacy-policy"],
      disallow: ["/api/", "/admin/", "/dashboard/", "/eoc/", "/settings/", "/profile/", "/login/", "/register/"]
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`
  };
}
