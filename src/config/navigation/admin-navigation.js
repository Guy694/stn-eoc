// โครงเมนูหลังบ้าน (ผู้ดูแลระบบ) จัดตาม "งานที่ต้องทำ" แทนโครงสร้างโปรแกรม
// 1) ภาพรวม  2) เหตุการณ์ที่เปิดอยู่ (แกนหลักของการกรอกข้อมูล)  3) งานรอดำเนินการ
// 4) ข้อมูลกลาง (ใช้ทุกเหตุการณ์)  5) บริหารระบบ  6) บัญชีของฉัน
// ไฟล์นี้ไม่ผูกกับ React/ไอคอน (ใช้ iconKey) เพื่อทดสอบได้ง่าย

export const EVENT_MODULES = {
  flood: {
    label: "อุทกภัย",
    pathPrefixes: ["/eoc/flood"],
    items: (ctx) => [
      { key: "brief", name: "สรุปสำหรับห้องประชุม", path: "/eoc/flood/meeting-brief", iconKey: "command", description: "เรื่องเร่งด่วนจากทุกงานในหน้าเดียว พิมพ์ได้" },
      { key: "overview", name: "ภาพรวมสถานการณ์", path: "/eoc/flood/overview", iconKey: "overview" },
      { key: "command", name: "ภารกิจและข้อสั่งการ", path: "/eoc/flood/management/directives", iconKey: "command", description: "สถานการณ์/ข้อสั่งการรายวัน ภารกิจ ประชุม บันทึกการตัดสินใจ" },
      { key: "records", name: "บันทึกพื้นที่น้ำท่วม", path: "/eoc/flood/records", iconKey: "flood" },
      { key: "shelters", name: "ศูนย์พักพิง", path: `/eoc/shelters?eoc=flood${ctx.sessionId ? `&session=${ctx.sessionId}` : ""}`, iconKey: "shelter", description: "เปิดใช้ศูนย์และอัปเดตยอดผู้พักพิง" },
      { key: "vulnerable", name: "กลุ่มเปราะบาง", path: "/eoc/flood/vulnerable-groups", iconKey: "vulnerable", description: "ได้รับผลกระทบ ดูแลแล้ว เคลื่อนย้ายแล้ว" },
      { key: "affected", name: "ผู้ได้รับผลกระทบ", path: "/eoc/flood/affected", iconKey: "people" },
      { key: "health", name: "โรคและสุขภาพ", path: "/eoc/flood/health", iconKey: "health", description: "ผู้ป่วยในศูนย์พักพิงและในชุมชนช่วงน้ำท่วม" },
      { key: "supplies", name: "เวชภัณฑ์และคลังยา", path: "/eoc/flood/supplies", iconKey: "inventory", description: "คงคลัง รับเข้า เบิกจ่าย รายการใกล้หมด" },
      { key: "it-support", name: "รายงาน IT support", path: "/eoc/flood/it-support", iconKey: "server", description: "ปัญหาระบบ อินเทอร์เน็ต อุปกรณ์ และการแก้ไข" },
      { key: "team", name: "ทีมปฏิบัติการ", path: "/eoc/flood/operations-team", iconKey: "team" }
    ]
  },
  disease: {
    label: "โรคระบาด",
    pathPrefixes: ["/eoc/disease", "/eoc/dengue"],
    items: () => [
      { key: "overview", name: "ภาพรวมสถานการณ์", path: "/eoc/disease/overview", iconKey: "overview" },
      { key: "command", name: "จัดการ EOC", path: "/eoc/disease/management", iconKey: "command" },
      { key: "records", name: "บันทึกรายงานผู้ป่วย", path: "/eoc/disease/records", iconKey: "records" },
      { key: "facility-reports", name: "รายงานจากหน่วยบริการ", path: "/eoc/disease/records?tab=facility", iconKey: "health" },
      { key: "daily", name: "สรุปรายวัน", path: "/eoc/disease/daily-risk", iconKey: "daily" },
      { key: "map", name: "แผนที่", path: "/eoc/disease/map", iconKey: "map" },
      { key: "vulnerable", name: "กลุ่มเปราะบาง", path: "/eoc/disease/vulnerable-groups", iconKey: "vulnerable", description: "ได้รับผลกระทบ ดูแลแล้ว เคลื่อนย้ายแล้ว" },
      { key: "it-support", name: "รายงาน IT support", path: "/eoc/disease/it-support", iconKey: "server", description: "ปัญหาระบบ อินเทอร์เน็ต อุปกรณ์ และการแก้ไข" }
    ]
  },
  "festival-accidents": {
    label: "อุบัติเหตุช่วงเทศกาล",
    pathPrefixes: ["/eoc/festival-accidents", "/eoc/accident"],
    items: () => [
      { key: "overview", name: "ภาพรวมเทศกาล", path: "/eoc/festival-accidents", iconKey: "overview" },
      { key: "records", name: "บันทึกอุบัติเหตุ", path: "/eoc/accident/records", iconKey: "accident" },
      { key: "service-points", name: "จุดบริการชั่วคราว", path: "/eoc/accident/service-points", iconKey: "checkpoint" },
      { key: "compare", name: "เปรียบเทียบเทศกาล", path: "/eoc/festival-accidents/compare", iconKey: "compare" }
    ]
  }
};

function eventTitle(type, status) {
  const definition = EVENT_MODULES[type];
  const name = type === "disease" && status?.disease_name ? status.disease_name : definition.label;
  return status?.session_number ? `${name} ครั้งที่ ${status.session_number}` : name;
}

/**
 * ส่วน "เหตุการณ์ที่เปิดอยู่": แสดงทุก EOC ที่เปิดอยู่ (ขยายไว้)
 * และแสดง EOC ที่ปิดแล้วเฉพาะเมื่อกำลังเปิดหน้าของ EOC นั้นอยู่ (ป้าย "ปิดแล้ว")
 */
export function buildEventSections({ eocStatus = {}, pathname = "" }) {
  return Object.entries(EVENT_MODULES)
    .map(([type, definition]) => {
      const status = eocStatus[type];
      const isActive = Boolean(status?.is_active);
      const onPage = definition.pathPrefixes.some((prefix) => pathname.startsWith(prefix));
      if (!isActive && !onPage) return null;
      return {
        section: `event-${type}`,
        key: `event-${type}`,
        group: "events",
        title: eventTitle(type, status),
        eocType: type,
        eventState: isActive ? "open" : "closed",
        collapsible: true,
        defaultExpanded: isActive || onPage,
        items: definition.items({ sessionId: status?.session_id || null })
      };
    })
    .filter(Boolean);
}

export function buildAdminMenu({ eocStatus = {}, pathname = "" } = {}) {
  const events = buildEventSections({ eocStatus, pathname });
  const anyOpen = events.some((section) => section.eventState === "open");

  return [
    {
      section: "overview",
      title: "ภาพรวม",
      items: [
        { name: "หน้าหลัก", path: "/dashboard", iconKey: "home" },
        { name: "ห้องบัญชาการ", path: "/commander/dashboard", iconKey: "command", description: "ภาพรวมสำหรับประชุมและตัดสินใจ" },
        { name: "วิเคราะห์ข้อมูล", path: "/analytics", iconKey: "analytics" }
      ]
    },
    {
      section: "events-heading",
      title: "เหตุการณ์ที่เปิดอยู่",
      group: "events-heading",
      emptyMessage: anyOpen ? null : "ยังไม่มีเหตุการณ์ที่เปิดอยู่",
      items: anyOpen ? [] : [{ name: "เปิด EOC", path: "/admin/eoc-management", iconKey: "power" }]
    },
    ...events,
    {
      section: "pending",
      title: "งานรอดำเนินการ",
      items: [
        { name: "คำขอจากประชาชน", path: "/admin/incident-reports", iconKey: "inbox", badge: "pendingReports", description: "คำขอความช่วยเหลือและรายงานเส้นทาง" },
        { name: "คำขอสมัครเจ้าหน้าที่", path: "/admin/officers", iconKey: "userCheck", badge: "pendingRegistrations" }
      ]
    },
    {
      section: "registry",
      title: "ข้อมูลกลาง",
      collapsible: true,
      defaultExpanded: false,
      description: "ข้อมูลที่ใช้ร่วมกันทุกเหตุการณ์",
      items: [
        { name: "ทะเบียนศูนย์พักพิง", path: "/eoc/shelters?tab=registry", iconKey: "shelter" },
        { name: "ทะเบียนกลุ่มเปราะบาง", path: "/eoc/vulnerable-groups", iconKey: "vulnerable" },
        { name: "หน่วยบริการสุขภาพ", path: "/admin/health-facilities", iconKey: "health" },
        { name: "หมู่บ้านและพื้นที่", path: "/admin/village-polygons", iconKey: "map" },
        { name: "เวชภัณฑ์และคงคลัง", path: "/resources/medical-inventory", iconKey: "inventory" },
        { name: "ทรัพยากร IT", path: "/admin/it-resources", iconKey: "server" },
        { name: "ข้อมูลอ้างอิงอื่น", path: "/admin/master-data/agencies", iconKey: "database", description: "หน่วยงาน โรค ภัย ความเสี่ยง เส้นทาง" }
      ]
    },
    {
      section: "communication",
      title: "สื่อสาร",
      items: [
        { name: "ประกาศ", path: "/announcements", iconKey: "megaphone" }
      ]
    },
    {
      section: "system",
      title: "บริหารระบบ",
      collapsible: true,
      defaultExpanded: false,
      items: [
        { name: "เปิด/ปิด EOC", path: "/admin/eoc-management", iconKey: "power" },
        { name: "ประวัติเหตุการณ์", path: "/admin/eoc-sessions", iconKey: "history" },
        { name: "เจ้าหน้าที่และสิทธิ์", path: "/admin/officers", iconKey: "users" },
        { name: "ผู้ใช้ประชาชน", path: "/admin/citizens", iconKey: "people" },
        { name: "ตรวจคุณภาพข้อมูล", path: "/admin/data-management", iconKey: "database" },
        { name: "ประวัติการใช้งาน", path: "/admin/activity-logs", iconKey: "log" },
        { name: "ถังขยะ", path: "/admin/trash", iconKey: "trash", description: "ข้อมูลที่ถูกลบ กู้คืนได้" }
      ]
    },
    {
      section: "account",
      title: "บัญชีของฉัน",
      items: [
        { name: "โปรไฟล์", path: "/profile", iconKey: "profile" },
        { name: "ตั้งค่า", path: "/settings", iconKey: "settings" },
        { name: "คู่มือเจ้าหน้าที่", path: "/eoc/guide", iconKey: "guide" }
      ]
    }
  ];
}

/** ตรงกับเมนูไหน: เทียบ path และ query ที่ระบุในเมนู (เช่น ?tab=registry) */
export function isMenuItemActive(item, pathname, search = "") {
  const [itemPath, itemQuery = ""] = item.path.split("?");
  if (pathname !== itemPath && !(itemPath !== "/" && pathname === `${itemPath}/`)) return false;
  // เทียบเฉพาะ "แท็บ" — เมนูที่ไม่ระบุแท็บคือแท็บเริ่มต้นของหน้า จึงไม่ active เมื่อกำลังดูแท็บอื่น
  const currentTab = new URLSearchParams(search).get("tab") || "";
  const wantedTab = new URLSearchParams(itemQuery).get("tab") || "";
  return currentTab === wantedTab;
}
