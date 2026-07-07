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

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

function statusClass(status) {
  if (status === "เปิดให้บริการ") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "รับแจ้งเหตุ") return "border-orange-200 bg-orange-50 text-orange-700";
  if (status === "24 ชั่วโมง") return "border-red-200 bg-red-50 text-red-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function hotlineTone(category) {
  if (category === "medical") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (category === "safety") return "border-red-200 bg-red-50 text-red-700";
  if (category === "coordination") return "border-orange-200 bg-orange-50 text-orange-700";
  if (category === "local") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function toAgencyContact(item) {
  return {
    id: item.slug || item.id,
    name: item.name,
    role: item.role_description || "-",
    area: item.area || "-",
    phone: item.phone || "",
    secondary: item.secondary_contact || "",
    category: item.category || "coordination",
    status: item.status || "พร้อมประสานงาน",
    isHotline: Boolean(item.is_hotline)
  };
}

export default function PublicAgenciesPage() {
  const [eocIsOpen, setEocIsOpen] = useState(false);
  const [eocStatus, setEocStatus] = useState("closed");
  const [eocLabel, setEocLabel] = useState("สถานะศูนย์");
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [district, setDistrict] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statusRes, contactsRes] = await Promise.all([
          fetch("/stn-eoc/api/eoc/status/"),
          fetch("/stn-eoc/api/public/agency-contacts")
        ]);

        const statusJson = statusRes.ok ? await statusRes.json() : { success: false, data: [] };
        const contactsJson = contactsRes.ok ? await contactsRes.json() : { success: false, data: [] };
        const activeAll = (statusJson.success ? statusJson.data || [] : []).filter((item) => Boolean(item.is_active));

        setEocIsOpen(activeAll.length > 0);
        setEocStatus(activeAll.length > 0 ? "open" : "closed");
        setEocLabel(activeAll[0] ? activeAll[0].name_th || activeAll[0].eoc_type : "ไม่มี EOC ที่เปิดอยู่");
        setContacts(contactsJson.success ? (contactsJson.data || []).map(toAgencyContact) : []);
      } catch (error) {
        console.error("Error loading agencies:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const agencies = useMemo(
    () => contacts.filter((item) => !item.isHotline),
    [contacts]
  );

  const hotlines = useMemo(
    () => contacts.filter((item) => item.isHotline),
    [contacts]
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
    const districtCount = new Set(agencies.map((item) => item.area).filter((area) => area && area.startsWith("อ."))).size;
    return {
      total: agencies.length,
      medical: agencies.filter((item) => item.category === "medical").length,
      safety: agencies.filter((item) => item.category === "safety").length,
      local: agencies.filter((item) => item.category === "local").length,
      hotlines: hotlines.length,
      districts: districtCount || 7
    };
  }, [agencies, hotlines]);

  return (
    <PublicOpsScaffold
      title="หน่วยงาน / Agencies"
      subtitle="ข้อมูลหน่วยงานที่เกี่ยวข้องกับการปฏิบัติการฉุกเฉิน จังหวัดสตูล"
      activeMenu="agencies"
      eocIsOpen={eocIsOpen}
      eocStatus={eocStatus}
      eocLabel={eocLabel}
    >
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <aside className="space-y-3">
          <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black text-blue-900">ช่องทางติดต่อฉุกเฉิน</h3>
              <span className="text-xs font-bold text-slate-500">24 ชั่วโมง</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {loading ? (
                <div className="rounded-xl border border-slate-100 p-4 text-center text-sm text-slate-500">
                  กำลังโหลดสายด่วน...
                </div>
              ) : hotlines.length === 0 ? (
                <div className="rounded-xl border border-slate-100 p-4 text-center text-sm text-slate-500">
                  ไม่พบข้อมูลสายด่วน
                </div>
              ) : hotlines.map((item) => (
                <a
                  key={item.id}
                  href={`tel:${item.phone}`}
                  className={`rounded-xl border p-4 shadow-sm transition hover:shadow-md ${hotlineTone(item.category)}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-3xl font-black leading-none">{item.phone}</p>
                      <p className="mt-1 text-sm font-bold">{item.name}</p>
                    </div>
                    <span className="text-2xl">☎</span>
                  </div>
                </a>
              ))}
            </div>
          </section>

     
        </aside>

          <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-blue-900">หน่วยงาน</h3>
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
                        {item.phone ? (
                          <a href={`tel:${item.phone}`} className="mt-1 inline-flex font-bold text-blue-700 hover:underline">{item.phone}</a>
                        ) : (
                          <p className="mt-1 text-xs font-bold text-slate-400">ไม่มีเบอร์ติดต่อ</p>
                        )}
                        {item.secondary && <p className="text-xs text-slate-500">{item.secondary}</p>}
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

        </div>

      
      </section>
    </PublicOpsScaffold>
  );
}
