import Link from "next/link";
import SiteViewCounter from "@/components/SiteViewCounter";
import { APP_VERSION_LABEL } from "@/lib/appVersion";

const EMERGENCY_NUMBERS = [
    ["1669", "เจ็บป่วยฉุกเฉิน"],
    ["1784", "สาธารณภัย (ปภ.)"],
    ["191", "เหตุด่วนเหตุร้าย"],
    ["199", "ดับเพลิง"]
];

// หน่วยงาน/แหล่งที่ให้ข้อมูลผ่าน API แก่ระบบนี้ (แสดงเป็นเครดิต)
const DATA_PROVIDERS = [
    ["GISTDA (สทอภ.)", "ฝุ่น PM2.5 • พื้นที่น้ำท่วมซ้ำซาก", "https://www.gistda.or.th/"],
    ["ThaiWater (สสน.)", "ระดับน้ำ • ปริมาณฝน • คำเตือน", "https://www.thaiwater.net/"],
    ["กรมอุตุนิยมวิทยา", "พยากรณ์อากาศ • เรดาร์ฝน", "https://www.tmd.go.th/"],
    ["Open-Meteo", "พยากรณ์ฝน/ลม/คลื่น • ปริมาณน้ำท่า • ระดับน้ำทะเล", "https://open-meteo.com/"],
    ["RainViewer", "ภาพเรดาร์ฝน", "https://www.rainviewer.com/"],
    ["Windy.com", "แผนที่ลม/คลื่น", "https://www.windy.com/"],
    ["IOC Sea Level Monitoring (UNESCO)", "ระดับน้ำทะเล • น้ำทะเลหนุน", "https://www.ioc-sealevelmonitoring.org/"],
    // ขอบเขตอำเภอ/ตำบล (public/geo/satun-districts.json, ตาราง districts_polygon, tambons_polygon) — CC BY-IGO ต้องแสดงที่มา
    ["กรมแผนที่ทหาร (ผ่าน UN OCHA)", "ขอบเขตอำเภอ • ขอบเขตตำบล", "https://data.humdata.org/dataset/cod-ab-tha"]
];

export default function Footer() {
    return (
        <footer className="relative isolate overflow-hidden bg-[#0a2742] text-[#c9dcee]">
            {/* ภาพทะเลสตูลยามค่ำ: ภาพตกแต่ง (alt ว่าง) โหลดเมื่อเลื่อนถึง — ชั้นสีด้านบนทำให้ตัวหนังสืออ่านง่าย */}
            <picture>
                <source type="image/webp" srcSet="/stn-eoc/img/darkfooter-1100.webp 1100w, /stn-eoc/img/darkfooter-2172.webp 2172w" sizes="100vw" />
                <img
                    src="/stn-eoc/img/darkfooter-2172.webp"
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-[78%_35%] sm:object-[70%_40%]"
                />
            </picture>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(7,24,43,.55)_0%,rgba(7,24,43,.35)_35%,rgba(6,22,40,.82)_78%,rgba(5,18,33,.96)_100%)] lg:bg-[linear-gradient(90deg,rgba(7,24,43,.78)_0%,rgba(7,24,43,.5)_55%,rgba(7,24,43,.38)_100%),linear-gradient(180deg,transparent_55%,rgba(5,18,33,.92)_100%)]" />
            <div className="container mx-auto px-4 pb-6 pt-10 sm:pt-12">
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <h4 className="mb-2 text-sm font-bold text-white sm:text-base">ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล</h4>
                        <p className="text-xs sm:text-sm">Satun Provincial Emergency Operations Center (Satun Geo-EOC)</p>
                    </div>

                    <div>
                        <h4 className="mb-2 text-sm font-bold text-white sm:text-base">เบอร์ฉุกเฉิน (โทรฟรี 24 ชม.)</h4>
                        <ul className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                            {EMERGENCY_NUMBERS.map(([number, label]) => (
                                <li key={number}>
                                    <a href={`tel:${number}`} className="block rounded-lg bg-white/10 px-2 py-1.5 ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20">
                                        <span className="block font-black text-white">{number}</span>
                                        <span className="block text-[11px]">{label}</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="mb-2 text-sm font-bold text-white sm:text-base">ข้อมูลและความช่วยเหลือ</h4>
                        <ul className="space-y-1.5 text-xs sm:text-sm">
                            <li><Link href="/public/help/faq" className="hover:text-white">คำถามที่พบบ่อย</Link></li>
                            <li><Link href="/privacy-policy" className="hover:text-white">นโยบายความเป็นส่วนตัว</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="mb-2 text-sm font-bold text-white sm:text-base">ลิงก์ที่เกี่ยวข้อง</h4>
                        <ul className="space-y-1.5 text-xs sm:text-sm">
                            <li><a href="https://satun.moph.go.th/" target="_blank" rel="noopener noreferrer" className="hover:text-white">สำนักงานสาธารณสุขจังหวัดสตูล</a></li>
                            <li><a href="https://www.moph.go.th/" target="_blank" rel="noopener noreferrer" className="hover:text-white">กระทรวงสาธารณสุข</a></li>
                        </ul>
                        <h5 className="mb-1.5 mt-4 text-xs font-bold text-white sm:text-sm">ขอขอบคุณหน่วยงานที่ให้ข้อมูลจาก</h5>
                        <ul className="space-y-1 text-xs sm:text-sm">
                            {DATA_PROVIDERS.map(([name, , url]) => (
                                <li key={name}>
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-white">{name}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-white/15 pt-4 text-xs sm:flex-row sm:text-sm">
                    <p>&copy; 2025–2026 สำนักงานสาธารณสุขจังหวัดสตูล - All Rights Reserved <span className="ml-1 text-[#9fc0d8]" title="เวอร์ชันของระบบ">{APP_VERSION_LABEL}</span></p>
                    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-end">
                        <SiteViewCounter className="text-[#c9dcee]" />
                        <Link href="/login" className="text-[#9fc0d8] hover:text-white">เข้าสู่ระบบเจ้าหน้าที่</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
