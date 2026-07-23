export const dengueSatConfig = Object.freeze({
  dashboardTitle: "สรุปสถานการณ์ไข้เลือดออก",
  dataSource: "/api/eoc/disease/daily-risk",
  metrics: ["total_patients", "total_reports", "diseases_count", "affected_districts"],
});
