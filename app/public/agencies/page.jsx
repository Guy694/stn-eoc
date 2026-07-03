"use client";

import { useEffect, useMemo, useState } from "react";
import PublicOpsScaffold from "@/components/public/PublicOpsScaffold";

const CATEGORY_META = {
  all: { label: "ทั้งหมด", color: "bg-blue-700 text-white border-blue-700" },
  medical: { label: "สาธารณสุข", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  safety: { label: "ความปลอดภัย", color: "bg-red-50 text-red-700 border-red-200" },
  local: { label: "ปกครอง/อปท.", color: "bg-violet-50 text-violet-700 border-violet-200" },
  utility: { label: "สาธารณูปโภค", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  coordination: { label: "ประสานงาน", color: "bg-orange-50 text-orange-700 border-orange-200" }
};

const HOTLINES = [
  { label: "เหตุฉุกเฉินตำรวจ", number: "191", category: "safety", tone: "border-blue-200 bg-blue-50 text-blue-700" },
  { label: "ดับเพลิง", number: "199", category: "safety", tone: "border-red-200 bg-red-50 text-red-700" },
  { label: "หน่วยแพทย์ฉุกเฉิน", number: "1669", category: "medical", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { label: "ปภ. สายด่วน", number: "1784", category: "coordination", tone: "border-orange-200 bg-orange-50 text-orange-700" },
  { label: "ศูนย์ดำรงธรรม", number: "1567", category: "coordination", tone: "border-violet-200 bg-violet-50 text-violet-700" }
];

const CORE_AGENCIES = [
  {
    id: "satun-health",
    name: "สำนักงานสาธารณสุขจังหวัดสตูล",
    role: "กำกับดูแลระบบสุขภาพและตอบโต้ภาวะฉุกเฉินด้านสุขภาพ",
    area: "ทั้งจังหวัดสตูล",
    phone: "074-711-123",
    secondary: "โทรสาร 074-711-124",
    category: "medical",
    status: "ปฏิบัติการปกติ"
  },
  {
    id: "ddpm-satun",
    name: "สำนักงานป้องกันและบรรเทาสาธารณภัยจังหวัดสตูล",
    role: "ประสานงานเหตุฉุกเฉินและสนับสนุนการช่วยเหลือ",
    area: "ทั้งจังหวัดสตูล",
    phone: "074-711-201",
    secondary: "สายด่วน 1784",
    category: "coordination",
    status: "ปฏิบัติการปกติ"
  },
  {
    id: "satun-hospital",
    name: "โรงพยาบาลสตูล",
    role: "ให้บริการรักษาพยาบาลระดับทุติยภูมิและรองรับส่งต่อ",
    area: "อ.เมืองสตูล และพื้นที่ใกล้เคียง",
    phone: "074-723-000",
    secondary: "โทรสาร 074-723-001",
    category: "medical",
    status: "เปิดให้บริการ"
  },
  {
    id: "police",
    name: "ตำรวจภูธรจังหวัดสตูล",
    role: "รักษาความปลอดภัย อำนวยความสะดวก และดูแลจราจร",
    area: "ทั้งจังหวัดสตูล",
    phone: "074-711-191",
    secondary: "สายด่วน 191",
    category: "safety",
    status: "ปฏิบัติการปกติ"
  },
  {
    id: "local-admin",
    name: "องค์กรปกครองส่วนท้องถิ่น",
    role: "ช่วยเหลือประชาชนในพื้นที่และสนับสนุนกำลังเจ้าหน้าที่",
    area: "ครอบคลุมพื้นที่ตำบล/เทศบาล",
    phone: "074-XXXXXX",
    secondary: "ประจำแต่ละพื้นที่",
    category: "local",
    status: "พร้อมประสานงาน"
  },
  {
    id: "districts",
    name: "ที่ทำการอำเภอ / เทศบาล",
    role: "บริหารจัดการพื้นที่และประสานงานเหตุฉุกเฉิน",
    area: "7 อำเภอ / 26 เทศบาล",
    phone: "074-XXXXXX",
    secondary: "ประจำแต่ละอำเภอ/เทศบาล",
    category: "local",
    status: "ปฏิบัติการปกติ"
  },
  {
    id: "electricity",
    name: "การไฟฟ้าส่วนภูมิภาคจังหวัดสตูล",
    role: "ดูแลเหตุไฟฟ้าขัดข้องและความปลอดภัยระบบไฟฟ้า",
    area: "ทั้งจังหวัดสตูล",
    phone: "1129",
    secondary: "PEA Contact Center",
    category: "utility",
    status: "รับแจ้งเหตุ"
  }
];

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

function facilityTypeLabel(typeCode) {
  const labels = {
    hosp: "โรงพยาบาล",
    rph: "รพ.สต.",
    hos: "สถานพยาบาล",
    pc: "หน่วยบริการปฐมภูมิ"
  };
  return labels[typeCode] || "หน่วยบริการสุขภาพ";
}

function toFacilityAgency(item) {
  const area = item.district
    ? String(item.district).startsWith("อ.") ? String(item.district) : `อ.${item.district}`
    : "จังหวัดสตูล";

  return {
    id: `facility-${item.id}`,
    name: item.name,
    role: facilityTypeLabel(item.typecode),
    area,
    phone: "074-XXXXXX",
    secondary: item.risk_level ? `ระดับเฝ้าระวัง ${item.risk_level}` : "หน่วยบริการในพื้นที่",
    category: "medical",
    status: "เปิดให้บริการ"
  };
}

function statusClass(status) {
  if (status === "เปิดให้บริการ") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "รับแจ้งเหตุ") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export default function PublicAgenciesPage() {
  const [eocIsOpen, setEocIsOpen] = useState(false);
  const [eocLabel, setEocLabel] = useState("สถานะศูนย์");
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [district, setDistrict] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statusRes, facilitiesRes] = await Promise.all([
          fetch("/stn-eoc/api/eoc/status/"),
          fetch("/stn-eoc/api/common/health-facilities")
        ]);

        const statusJson = statusRes.ok ? await statusRes.json() : { success: false, data: [] };
        const facilitiesJson = facilitiesRes.ok ? await facilitiesRes.json() : { success: false, data: [] };
        const activeAll = (statusJson.success ? statusJson.data || [] : []).filter((item) => Boolean(item.is_active));

        setEocIsOpen(activeAll.length > 0);
        setEocLabel(activeAll[0] ? activeAll[0].name_th || activeAll[0].eoc_type : "สถานะศูนย์");
        setFacilities(facilitiesJson.success ? facilitiesJson.data || [] : []);
      } catch (error) {
        console.error("Error loading agencies:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const facilityAgencies = useMemo(
    () => facilities.slice(0, 40).map(toFacilityAgency),
    [facilities]
  );

  const agencies = useMemo(
    () => [...CORE_AGENCIES, ...facilityAgencies],
    [facilityAgencies]
  );

  const districts = useMemo(
    () => [...new Set(agencies.map((item) => item.area).filter((area) => area && area.startsWith("อ.")))].sort(),
    [agencies]
  );

  const filteredAgencies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return agencies.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (district !== "all" && item.area !== district) return false;
      const haystack = `${item.name} ${item.role} ${item.area} ${item.phone}`.toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [agencies, category, district, search]);

  const stats = useMemo(() => {
    const districtCount = new Set(facilities.map((item) => item.district).filter(Boolean)).size;
    return {
      total: agencies.length,
      medical: agencies.filter((item) => item.category === "medical").length,
      safety: agencies.filter((item) => item.category === "safety").length,
      local: agencies.filter((item) => item.category === "local").length,
      districts: districtCount || 7
    };
  }, [agencies, facilities]);

  const areaContacts = [
    ["อำเภอเมืองสตูล", "รพ.สต.บ้านคลองขุด", "074-XXXXXX"],
    ["อำเภอละงู", "เทศบาลตำบลละงู", "074-XXXXXX"],
    ["อำเภอควนโดน", "สถานีตำรวจภูธรควนโดน", "074-XXXXXX"]
  ];

  return (
    <PublicOpsScaffold
      title="หน่วยงาน / Agencies"
      subtitle="ข้อมูลหน่วยงานที่เกี่ยวข้องกับการปฏิบัติการฉุกเฉิน จังหวัดสตูล"
      activeMenu="agencies"
      eocIsOpen={eocIsOpen}
      eocLabel={eocLabel}
    >
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="min-w-0 space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "จำนวนหน่วยงานที่เกี่ยวข้อง", value: stats.total, unit: "หน่วยงาน", className: "border-blue-200 bg-blue-50 text-blue-700" },
              { label: "หน่วยบริการสุขภาพ", value: stats.medical, unit: "แห่ง", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
              { label: "หน่วยความปลอดภัย", value: stats.safety, unit: "ทีม", className: "border-violet-200 bg-violet-50 text-violet-700" },
              { label: "พื้นที่ครอบคลุม", value: stats.districts, unit: "อำเภอ", className: "border-orange-200 bg-orange-50 text-orange-700" },
              { label: "สายด่วนให้บริการ", value: HOTLINES.length, unit: "สาย", className: "border-red-200 bg-red-50 text-red-700" }
            ].map((item) => (
              <div key={item.label} className={`rounded-xl border p-4 shadow-sm ${item.className}`}>
                <p className="text-xs font-bold">{item.label}</p>
                <p className="mt-1 text-3xl font-black leading-none">{formatNumber(item.value)}</p>
                <p className="mt-1 text-xs font-semibold">{item.unit}</p>
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-blue-900">ไดเรกทอรีหน่วยงาน</h3>
                <p className="text-xs text-slate-500">เลือกหมวด ค้นหา และโทรติดต่อได้ทันทีในกรณีฉุกเฉิน</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${category === key ? "border-blue-700 bg-blue-700 text-white" : meta.color}`}
                  >
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหาหน่วยงาน เบอร์โทร หรือพื้นที่"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400"
              />
              <select
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400"
              >
                <option value="all">ทุกพื้นที่</option>
                {districts.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-100">
              <div className="grid grid-cols-[minmax(220px,1.2fr)_minmax(180px,0.9fr)_minmax(140px,0.7fr)_150px] bg-slate-50 px-4 py-3 text-xs font-black text-slate-500 max-lg:hidden">
                <span>หน่วยงาน</span>
                <span>ภารกิจหลัก</span>
                <span>พื้นที่รับผิดชอบ</span>
                <span className="text-right">สถานะปัจจุบัน</span>
              </div>

              {loading ? (
                <div className="p-6 text-center text-sm text-slate-500">กำลังโหลดข้อมูลหน่วยงาน...</div>
              ) : filteredAgencies.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">ไม่พบหน่วยงานในเงื่อนไขนี้</div>
              ) : (
                <div className="max-h-[620px] overflow-auto">
                  {filteredAgencies.map((item) => (
                    <article key={item.id} className="grid grid-cols-[minmax(220px,1.2fr)_minmax(180px,0.9fr)_minmax(140px,0.7fr)_150px] gap-3 border-t border-slate-100 px-4 py-3 text-sm max-lg:block">
                      <div className="min-w-0">
                        <p className="truncate font-black text-blue-900">{item.name}</p>
                        <a href={`tel:${item.phone}`} className="mt-1 inline-flex font-bold text-blue-700 hover:underline">{item.phone}</a>
                        <p className="text-xs text-slate-500">{item.secondary}</p>
                      </div>
                      <p className="text-slate-700 max-lg:mt-2">{item.role}</p>
                      <p className="font-semibold text-slate-600 max-lg:mt-2">{item.area}</p>
                      <div className="text-right max-lg:mt-2 max-lg:text-left">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass(item.status)}`}>{item.status}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black text-blue-900">อัปเดตสำคัญรายวัน</h3>
              <span className="text-xs font-bold text-blue-700">ดูประวัติทั้งหมด</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["สำนักงาน ปภ.จังหวัด", "เตรียมทีมสนับสนุนภาคสนาม 5 ทีม"],
                ["รพ.สต. ในอำเภอควนโดน", "เปิดให้บริการเพิ่ม 2 แห่ง"],
                ["ท้องถิ่นร่วมซ้อมแผน", "เตรียมพื้นที่พักพิงและจุดบริการประชาชน"]
              ].map(([source, text], index) => (
                <div key={source} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-bold text-blue-700">{index + 1}. {source}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-3">
          <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black text-blue-900">ช่องทางติดต่อฉุกเฉิน</h3>
              <span className="text-xs font-bold text-slate-500">24 ชั่วโมง</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {HOTLINES.map((item) => (
                <a
                  key={item.number}
                  href={`tel:${item.number}`}
                  className={`rounded-xl border p-4 shadow-sm transition hover:shadow-md ${item.tone}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-3xl font-black leading-none">{item.number}</p>
                      <p className="mt-1 text-sm font-bold">{item.label}</p>
                    </div>
                    <span className="text-2xl">☎</span>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black text-blue-900">หน่วยงานแนะนำตามพื้นที่</h3>
              <span className="text-xs font-bold text-blue-700">ดูทั้งหมด</span>
            </div>
            <div className="space-y-2">
              {areaContacts.map(([area, name, phone]) => (
                <div key={`${area}-${name}`} className="grid grid-cols-[minmax(0,1fr)_108px] gap-2 rounded-lg border border-slate-100 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-black text-slate-800">{area}</p>
                    <p className="truncate text-xs text-slate-500">{name}</p>
                  </div>
                  <a href={`tel:${phone}`} className="text-right text-xs font-black text-blue-700">{phone}</a>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-black text-blue-900">ขั้นตอนการขอความช่วยเหลือ</h3>
            {[
              ["1", "แจ้งเหตุ", "โทรสายด่วนหรือแจ้งผ่านช่องทางออนไลน์"],
              ["2", "ประสานงาน", "หน่วยงานรับเรื่องและจัดส่งทีม"],
              ["3", "ให้ความช่วยเหลือ", "ทีมภาคสนามเข้าพื้นที่และอพยพ"],
              ["4", "ติดตามผล", "ประเมินสถานการณ์และฟื้นฟูพื้นที่"]
            ].map(([step, title, text]) => (
              <div key={step} className="mb-3 flex gap-3 last:mb-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 font-black text-blue-700">{step}</span>
                <div>
                  <p className="text-sm font-black text-slate-800">{title}</p>
                  <p className="text-xs text-slate-500">{text}</p>
                </div>
              </div>
            ))}
          </section>
        </aside>
      </section>
    </PublicOpsScaffold>
  );
}
