import { getSiteUrl } from "@/lib/siteUrl";

const PUBLIC_PATHS = [
  "",
  "/public/disaster-map",
  "/public/weather-watch",
  "/public/shelters",
  "/public/announcements",
  "/public/agencies",
  "/public/insights",
  "/public/help",
  "/public/help/citizen-guide",
  "/public/help/faq",
  "/public/report-incident",
  "/public/report-problem",
  "/public/report-water",
  "/privacy-policy"
];

export default function sitemap() {
  const siteUrl = getSiteUrl();
  return PUBLIC_PATHS.map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: path === "" ? "hourly" : "daily",
    priority: path === "" ? 1 : path.includes("report-incident") ? 0.9 : 0.7
  }));
}
