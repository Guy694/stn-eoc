import Link from "next/link";
import { LifeBuoy, MapPin, Navigation, Phone, ShieldAlert, Tent, Waves } from "lucide-react";
import PublicLayout from "@/components/layouts/PublicLayout";
import { getOfflinePack } from "@/lib/offlinePackData";

// Emergency information in English for visitors (Koh Lipe, Tarutao, Pak Bara, Satun town)
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Emergency information in English",
  description: "Satun province emergency numbers, current warnings, open evacuation shelters and flood safety advice for visitors."
};

const NUMBERS = [
  { phone: "1669", label: "Medical emergency / ambulance", tone: "bg-red-700" },
  { phone: "1155", label: "Tourist Police (English spoken)", tone: "bg-[#0b4c86]" },
  { phone: "191", label: "Police", tone: "bg-[#0c2f4a]" },
  { phone: "199", label: "Fire", tone: "bg-[#0c2f4a]" },
  { phone: "1784", label: "Disaster prevention (DDPM)", tone: "bg-[#0c2f4a]" }
];
const EVENT_EN = { flood: "Flood response is active", disease: "Disease outbreak response is active", festival: "Holiday road-safety operation is active" };
const SEA_EN = { normal: "Normal", elevated: "Higher than usual", high: "High tide surge", record: "Highest in 30 days" };
const ADVICE = [
  "Stay away from canals, rivers and fast-moving water. 15 cm of moving water can knock you down; 30 cm can float a car.",
  "Do not drive or ride through flooded roads.",
  "Keep your phone charged and your passport, money and medicines in a waterproof bag.",
  "On the islands, follow instructions from park rangers, hotel staff and boat operators. Do not take boats when trips are cancelled.",
  "If you are told to evacuate, go to the nearest open shelter below or to higher ground."
];
const when = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }) : "");
const mapsUrl = (lat, lon) => `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

export default async function EnglishEmergencyPage() {
  const pack = await getOfflinePack().catch(() => null);
  const high = (pack?.warnings || []).filter((w) => w.level === "high");
  const events = pack?.events || [];

  return (
    <PublicLayout>
      <div lang="en" className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6">
        <header>
          <p className="text-sm font-semibold text-[#2a9db0]">Satun Province, Thailand</p>
          <h1 className="mt-1 font-[family-name:var(--font-kanit)] text-3xl font-bold text-[#0c2f4a]">Emergency information for visitors</h1>
          <p className="mt-2 text-[1.05rem] leading-8 text-slate-700">
            Official information from the Satun Provincial Public Health Emergency Operations Center.
            Updated {when(pack?.generated_at)} (Thailand time). Detailed warnings are issued in Thai.
          </p>
        </header>

        <section aria-labelledby="call-title" className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
          <h2 id="call-title" className="flex items-center gap-2 font-[family-name:var(--font-kanit)] text-xl font-semibold text-[#0c2f4a]"><Phone className="h-5 w-5" aria-hidden="true" />Call for help (free, 24 hours)</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {NUMBERS.map((n) => (
              <a key={n.phone} href={`tel:${n.phone}`} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-white hover:opacity-90 ${n.tone}`}>
                <span className="font-[family-name:var(--font-kanit)] text-3xl font-bold tabular-nums">{n.phone}</span>
                <span className="text-sm leading-5">{n.label}</span>
              </a>
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-500">Calls work without mobile data. From a foreign SIM, dial the number as shown.</p>
        </section>

        <section aria-labelledby="now-title" className={`rounded-3xl p-5 ring-1 ${high.length ? "bg-red-50 ring-red-200" : "bg-white ring-slate-200"}`}>
          <h2 id="now-title" className="flex items-center gap-2 font-[family-name:var(--font-kanit)] text-xl font-semibold text-[#0c2f4a]"><ShieldAlert className="h-5 w-5" aria-hidden="true" />Situation now</h2>
          <ul className="mt-3 space-y-2 text-[1.05rem] leading-7">
            <li>{high.length ? <b className="text-red-800">{high.length} urgent official warning{high.length > 1 ? "s" : ""} in Satun right now (heavy rain or flooding).</b> : "No urgent warnings at the moment."}</li>
            {events.map((e) => <li key={`${e.type}-${e.opened_at}`}>{EVENT_EN[e.type] || "An emergency operation is active"} since {when(e.opened_at)}.</li>)}
            {pack?.sea ? <li className="flex items-start gap-2"><Waves className="mt-1 h-4 w-4 shrink-0 text-[#2a9db0]" aria-hidden="true" />Sea level off Satun town: {SEA_EN[pack.sea.key] || pack.sea.label}{pack.sea.next_high?.at ? ` • next high tide ${when(pack.sea.next_high.at)}` : ""}</li> : null}
          </ul>
          {high.length ? (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold text-red-900">Show warnings (Thai)</summary>
              <ul lang="th" className="mt-2 space-y-1 text-slate-700">{high.map((w) => <li key={w.message}>• {w.message}</li>)}</ul>
            </details>
          ) : null}
        </section>

        <section aria-labelledby="shelter-title" className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
          <h2 id="shelter-title" className="flex items-center gap-2 font-[family-name:var(--font-kanit)] text-xl font-semibold text-[#0c2f4a]"><Tent className="h-5 w-5" aria-hidden="true" />Open evacuation shelters</h2>
          {pack?.shelters?.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {pack.shelters.map((s) => (
                <li key={`${s.name}-${s.lat}`} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span lang="th" className="block font-semibold text-slate-900">{s.name}</span>
                    <span lang="th" className="block text-sm text-slate-500">{[s.tambon && `ต.${s.tambon}`, s.district && `อ.${s.district}`].filter(Boolean).join(" ")}{s.vacancy != null ? <span lang="en"> • {s.vacancy} places free</span> : null}</span>
                  </span>
                  {s.lat != null && s.lon != null ? <a href={mapsUrl(s.lat, s.lon)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#0b4c86] px-3 text-sm font-bold text-white hover:bg-[#083865]"><Navigation className="h-4 w-4" aria-hidden="true" />Directions</a> : null}
                  {s.phone ? <a href={`tel:${String(s.phone).replace(/[^\d]/g, "")}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Phone className="h-4 w-4" aria-hidden="true" />Call</a> : null}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-slate-600">No shelters are open right now. Shelters open when the province activates its emergency operation.</p>}
        </section>

        <section aria-labelledby="advice-title" className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
          <h2 id="advice-title" className="flex items-center gap-2 font-[family-name:var(--font-kanit)] text-xl font-semibold text-[#0c2f4a]"><LifeBuoy className="h-5 w-5" aria-hidden="true" />Stay safe in heavy rain and floods</h2>
          <ul className="mt-3 space-y-2 text-[1.05rem] leading-7 text-slate-800">
            {ADVICE.map((a) => <li key={a} className="flex gap-2"><span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2a9db0]" />{a}</li>)}
          </ul>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Link href="/public/my-risk" className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 hover:ring-[#0b4c86]">
            <MapPin className="h-5 w-5 text-[#0b4c86]" aria-hidden="true" />
            <span className="mt-2 block font-semibold text-[#0c2f4a]">Check flood risk at your location</span>
            <span className="block text-sm text-slate-500">Map page in Thai — tap “ใช้ตำแหน่งปัจจุบัน” to use your GPS location</span>
          </Link>
          <Link href="/public/help" className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 hover:ring-[#0b4c86]">
            <LifeBuoy className="h-5 w-5 text-red-700" aria-hidden="true" />
            <span className="mt-2 block font-semibold text-[#0c2f4a]">Request help online</span>
            <span className="block text-sm text-slate-500">Form in Thai. If you cannot read Thai, call 1155 (Tourist Police) instead.</span>
          </Link>
        </section>
      </div>
    </PublicLayout>
  );
}
