"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PublicOpsScaffold from "@/components/public/PublicOpsScaffold";
import { RISK_META } from "@/lib/weatherWatch";

const WeatherWatchMap = dynamic(() => import("@/components/weather/WeatherWatchMap"), {
  ssr: false,
  loading: () => <div className="flex h-[620px] items-center justify-center rounded-lg border border-blue-100 bg-white text-sm font-bold text-slate-500">กำลังโหลดแผนที่...</div>
});
const WeatherCharts = dynamic(() => import("@/components/weather/WeatherCharts"), {
  ssr: false,
  loading: () => <div className="h-[260px] rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">กำลังโหลดกราฟ...</div>
});

const FORECAST_TABS = [
  { key: "hourly", label: "รายชั่วโมง" },
  { key: "24h", label: "24 ชั่วโมง" },
  { key: "3d", label: "3 วัน" },
  { key: "7d", label: "7 วัน" }
];

const KPI_CONFIG = [
  { key: "temperature", label: "อุณหภูมิปัจจุบัน", suffix: "°C" },
  { key: "weather_condition", label: "สภาพอากาศขณะนี้" },
  { key: "rainfall_1h", label: "ฝนล่าสุด 1 ชั่วโมง", suffix: " มม." },
  { key: "rainfall_24h", label: "ฝนสะสม 24 ชั่วโมง", suffix: " มม." },
  { key: "humidity", label: "ความชื้นสัมพัทธ์", suffix: "%" },
  { key: "wind_speed", label: "ความเร็วลม", suffix: " กม./ชม." },
  { key: "rain_probability_24h", label: "โอกาสฝน 24 ชั่วโมง", suffix: "%" },
  { key: "risk_level", label: "ระดับเฝ้าระวัง", format: (value) => getRiskMeta(value).label }
];

function getRiskMeta(level) {
  return RISK_META[level] || RISK_META.normal;
}

function formatValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return `${value.toLocaleString("th-TH")}${suffix}`;
  return `${value}${suffix}`;
}

function formatDateTime(value, format = "datetime") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const options = format === "date"
    ? { day: "2-digit", month: "short", year: "numeric" }
    : { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };
  return date.toLocaleString("th-TH", options);
}

function statusClasses(level) {
  const meta = getRiskMeta(level);
  return `${meta.bg} ${meta.text} ${meta.border}`;
}

export default function WeatherWatchPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forecastTab, setForecastTab] = useState("hourly");

  const loadWeather = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/stn-eoc/api/public/weather-watch", {
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "โหลดข้อมูลไม่สำเร็จ");
      }
      setData(payload);
    } catch (err) {
      console.error("Weather Watch load error:", err);
      setError(err.message || "ไม่สามารถโหลดข้อมูลสภาพอากาศได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  const current = data?.weather_current || {};
  const districts = data?.district_weather || [];
  const warnings = data?.weather_warnings || [];
  const forecastItems = useMemo(() => {
    if (!data?.weather_forecast) return [];
    if (forecastTab === "7d") return data.weather_forecast.filter((item) => ["24h", "3d", "7d"].includes(item.period));
    return data.weather_forecast.filter((item) => item.period === forecastTab);
  }, [data, forecastTab]);

  const ranking = [...districts].sort((a, b) => b.risk_score - a.risk_score || b.rainfall_24h - a.rainfall_24h);
  const hasWeatherData = Boolean(data?.weather_current && districts.length > 0);

  return (
    <PublicOpsScaffold
      title="สภาพอากาศ / Weather Watch"
      subtitle="แผนที่เฝ้าระวังสภาพอากาศ ฝนสะสม ความเสี่ยงอุทกภัยน้ำท่วม วาตภัย ดินถล่ม และคำแนะนำประชาชน"
      activeMenu="weather"
      eocStatus={current.risk_level === "critical" ? "open" : "watch"}
      eocLabel="Weather Watch"
      showWeatherMenu
      showPageHeader={false}
      mainClassName="bg-[#edf5fc]"
    >
      <div className="space-y-3">
        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Satun Provincial Emergency Operations Centers (Satun Geo-EOC)</div>
              <h2 className="mt-1 text-2xl font-black text-blue-950 lg:text-3xl">สภาพอากาศ / Weather Watch</h2>
              <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
                ศูนย์ติดตามสภาพอากาศแบบแผนที่เป็นหลัก สำหรับฝนสะสม พยากรณ์ฝน คลื่นลมแรง และพื้นที่เสี่ยงของจังหวัดสตูล
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => loadWeather()}
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-800 hover:bg-blue-100"
              >
                รีเฟรชข้อมูล
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>อัปเดตล่าสุด: {formatDateTime(current.observed_at)} น.</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>แหล่งข้อมูล: {current.source || "Open-Meteo"}</span>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {!loading && !hasWeatherData ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-6 text-amber-800 shadow-sm">
            ยังไม่มีข้อมูลสภาพอากาศจริงจาก provider ในขณะนี้ ระบบจึงไม่แสดงข้อมูลจำลอง
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
              {KPI_CONFIG.map((item) => {
                const value = item.format ? item.format(current[item.key]) : formatValue(current[item.key], item.suffix);
                const risk = item.key === "risk_level" ? getRiskMeta(current[item.key]) : getRiskMeta(current.risk_level);
                return (
                  <div key={item.key} className={`min-h-[110px] rounded-lg border bg-white p-3 shadow-sm ${item.key === "risk_level" ? statusClasses(current[item.key]) : "border-slate-200"}`}>
                    <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">{item.label}</div>
                    <div className="mt-3 text-2xl font-black text-slate-900">{loading ? "..." : value}</div>
                    <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-500">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: risk.color }} />
                      จังหวัดสตูล
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-3">
                <WeatherWatchMap data={data || {}} />
              </div>
              <RightPanel warnings={warnings} ranking={ranking} advice={data?.safety_advice || []} />
            </section>

            {forecastItems.length > 0 && (
              <ForecastSection
                tab={forecastTab}
                onTabChange={setForecastTab}
                items={forecastItems}
              />
            )}

            {data?.charts && <WeatherCharts charts={data.charts} />}

            {districts.length > 0 && <DistrictWeatherTable districts={districts} />}

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">แหล่งข้อมูลสภาพอากาศจริง</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    หน้านี้เรียกข้อมูลผ่าน Backend API Route เท่านั้น และไม่ใช้ข้อมูลจำลองเมื่อ provider ไม่มีข้อมูล
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 text-xs font-bold text-slate-600 sm:grid-cols-2">
                  {(data?.integration_sources || []).map((source) => (
                    <div key={source.name} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <div className="font-black text-slate-900">{source.name}</div>
                      <div className="mt-1 line-clamp-2">{source.use}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </PublicOpsScaffold>
  );
}

function RightPanel({ warnings, ranking, advice }) {
  return (
    <aside className="space-y-3">
      <Panel title="ประกาศเตือนภัยสภาพอากาศ">
        <div className="space-y-2">
          {warnings.length === 0 && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm font-semibold leading-5 text-slate-600">
              ยังไม่มีประกาศเตือนภัยจริงจาก provider
            </div>
          )}
          {warnings.map((warning) => {
            const meta = getRiskMeta(warning.severity_level);
            return (
              <article key={warning.warning_id} className={`rounded-lg border p-3 ${statusClasses(warning.severity_level)}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-black">{warning.warning_type}</div>
                    <h4 className="mt-1 text-sm font-black text-slate-900">{warning.title}</h4>
                  </div>
                  <span className="rounded-full px-2 py-1 text-[11px] font-black text-white" style={{ backgroundColor: meta.color }}>{meta.label}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-700">{warning.message}</p>
                <div className="mt-2 grid gap-1 text-[11px] font-bold text-slate-600">
                  <span>พื้นที่: {warning.affected_districts.join(", ")}</span>
                  <span>เริ่ม: {formatDateTime(warning.start_datetime)} น.</span>
                  <span>สิ้นสุด: {formatDateTime(warning.end_datetime)} น.</span>
                  <span>หน่วยงาน: {warning.source}</span>
                </div>
                <button type="button" className="mt-3 rounded-md bg-white/75 px-3 py-1.5 text-xs font-black text-slate-800 shadow-sm hover:bg-white">
                  อ่านรายละเอียด
                </button>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title="พื้นที่เสี่ยงสูงวันนี้">
        <ol className="space-y-2">
          {ranking.length === 0 && (
            <li className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
              ยังไม่มีข้อมูลพื้นที่เสี่ยงจริง
            </li>
          )}
          {ranking.map((district, index) => {
            const meta = getRiskMeta(district.risk_level);
            return (
              <li key={district.district_id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-xs font-black text-slate-700 shadow-sm">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-slate-900">{district.district_name}</div>
                  <div className="text-xs font-semibold text-slate-500">ฝนสะสม {district.rainfall_24h} มม.</div>
                </div>
                <span className="rounded-full px-2 py-1 text-[11px] font-black text-white" style={{ backgroundColor: meta.color }}>{meta.label}</span>
              </li>
            );
          })}
        </ol>
      </Panel>

  
    </aside>
  );
}

function ForecastSection({ tab, onTabChange, items }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-900">Forecast Section</h3>
          <p className="text-sm text-slate-600">พยากรณ์อากาศรายชั่วโมง รายวัน และ 7 วัน พร้อมระดับความเสี่ยง</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          {FORECAST_TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={`rounded-md px-3 py-2 text-xs font-black transition ${tab === item.key ? "bg-blue-700 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "hourly" ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">เวลา</th>
                <th className="px-3 py-2">สภาพอากาศ</th>
                <th className="px-3 py-2 text-right">ฝน</th>
                <th className="px-3 py-2 text-right">อุณหภูมิ</th>
                <th className="px-3 py-2 text-right">ลม</th>
                <th className="px-3 py-2">ความเสี่ยง</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ForecastRow key={item.forecast_datetime} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {items.map((item) => (
            <ForecastCard key={item.forecast_datetime} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function ForecastRow({ item }) {
  const meta = getRiskMeta(item.risk_level);
  const date = new Date(item.forecast_datetime);
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-3 py-3 font-black text-slate-900">{date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</td>
      <td className="px-3 py-3 font-semibold text-slate-700">{item.weather_condition}</td>
      <td className="px-3 py-3 text-right font-black text-sky-700">{item.rainfall_forecast} มม.</td>
      <td className="px-3 py-3 text-right font-semibold text-slate-700">{item.temperature_max}°C</td>
      <td className="px-3 py-3 text-right font-semibold text-slate-700">{item.wind_speed} กม./ชม.</td>
      <td className="px-3 py-3"><span className="rounded-full px-2 py-1 text-xs font-black text-white" style={{ backgroundColor: meta.color }}>{meta.label}</span></td>
    </tr>
  );
}

function ForecastCard({ item }) {
  const meta = getRiskMeta(item.risk_level);
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-black text-slate-500">{formatDateTime(item.forecast_datetime, "date")}</div>
      <div className="mt-2 text-lg font-black text-slate-900">{item.weather_condition}</div>
      <div className="mt-3 grid gap-1 text-xs font-semibold text-slate-600">
        <span>ต่ำสุด/สูงสุด: {item.temperature_min}-{item.temperature_max}°C</span>
        <span>โอกาสฝน: {item.rain_probability}%</span>
        <span>ฝนคาดการณ์: {item.rainfall_forecast} มม.</span>
        <span>ลม: {item.wind_speed} กม./ชม.</span>
      </div>
      <span className="mt-3 inline-flex rounded-full px-2 py-1 text-xs font-black text-white" style={{ backgroundColor: meta.color }}>{meta.label}</span>
    </article>
  );
}

function DistrictWeatherTable({ districts }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-lg font-black text-slate-900">District Weather Table</h3>
        <p className="text-sm text-slate-600">ข้อมูลสภาพอากาศและความเสี่ยงรายอำเภอของจังหวัดสตูล</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-black uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">อำเภอ</th>
              <th className="px-3 py-2">สภาพอากาศ</th>
              <th className="px-3 py-2 text-right">อุณหภูมิ</th>
              <th className="px-3 py-2 text-right">ฝน 1 ชม.</th>
              <th className="px-3 py-2 text-right">ฝน 24 ชม.</th>
              <th className="px-3 py-2 text-right">โอกาสฝน</th>
              <th className="px-3 py-2 text-right">ลม</th>
              <th className="px-3 py-2">อุทกภัยน้ำท่วม</th>
              <th className="px-3 py-2">ดินถล่ม</th>
              <th className="px-3 py-2">คำแนะนำ</th>
              <th className="px-3 py-2">อัปเดตล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {districts.map((district) => (
              <tr key={district.district_id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-3 font-black text-slate-900">{district.district_name}</td>
                <td className="px-3 py-3 font-semibold text-slate-700">{district.weather_condition}</td>
                <td className="px-3 py-3 text-right">{district.temperature}°C</td>
                <td className="px-3 py-3 text-right">{district.rainfall_1h} มม.</td>
                <td className="px-3 py-3 text-right font-black text-sky-700">{district.rainfall_24h} มม.</td>
                <td className="px-3 py-3 text-right">{district.rain_probability_24h}%</td>
                <td className="px-3 py-3 text-right">{district.wind_speed} กม./ชม.</td>
                <td className="px-3 py-3"><RiskPill level={district.flood_risk} /></td>
                <td className="px-3 py-3"><RiskPill level={district.landslide_risk} /></td>
                <td className="max-w-[260px] px-3 py-3 text-xs leading-5 text-slate-600">{district.advice}</td>
                <td className="px-3 py-3 text-xs text-slate-500">{formatDateTime(district.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RiskPill({ level }) {
  const meta = getRiskMeta(level);
  return (
    <span className="inline-flex rounded-full px-2 py-1 text-xs font-black text-white" style={{ backgroundColor: meta.color }}>
      {meta.label}
    </span>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-base font-black text-slate-900">{title}</h3>
      {children}
    </section>
  );
}
