import Link from "next/link";
import SiteViewCounter from "@/components/SiteViewCounter";

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
    ["Open-Meteo", "พยากรณ์ฝน/ลม/คลื่น • ปริมาณน้ำท่า", "https://open-meteo.com/"],
    ["RainViewer", "ภาพเรดาร์ฝน", "https://www.rainviewer.com/"],
    ["Windy.com", "แผนที่ลม/คลื่น", "https://www.windy.com/"]
   
];

export default function Footer() {
    return (
        <footer className="border-t border-gray-700 bg-gray-800 text-gray-300">
            <div className="container mx-auto px-4 py-8">
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
                                    <a href={`tel:${number}`} className="block rounded-lg bg-gray-700/60 px-2 py-1.5 hover:bg-gray-700">
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
                            <li><Link href="/public/agencies" className="hover:text-white">ติดต่อหน่วยงาน</Link></li>
                            <li><Link href="/public/help/faq" className="hover:text-white">คำถามที่พบบ่อย</Link></li>
                            <li><Link href="/public/insights" className="hover:text-white">ข้อมูลเชิงลึกและสถิติ (สำหรับสื่อ/นักวิจัย)</Link></li>
                            <li><Link href="/privacy-policy" className="hover:text-white">นโยบายความเป็นส่วนตัว</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="mb-2 text-sm font-bold text-white sm:text-base">ลิงก์ที่เกี่ยวข้อง</h4>
                        <ul className="space-y-1.5 text-xs sm:text-sm">
                            <li><a href="https://satun.moph.go.th/" target="_blank" rel="noopener noreferrer" className="hover:text-white">สำนักงานสาธารณสุขจังหวัดสตูล</a></li>
                            <li><a href="https://www.moph.go.th/" target="_blank" rel="noopener noreferrer" className="hover:text-white">กระทรวงสาธารณสุข</a></li>
                        </ul>
                        <h5 className="mb-1.5 mt-4 text-xs font-bold text-white sm:text-sm">ขอขอบคุณหน่วยงานที่ให้ข้อมูล</h5>
                        <ul className="space-y-1.5 text-xs sm:text-sm">
                            {DATA_PROVIDERS.map(([name, detail, url]) => (
                                <li key={name}>
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="block hover:text-white">
                                        <span className="font-semibold">{name}</span>
                                        <span className="block text-[11px] text-gray-400">{detail}</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-gray-700 pt-4 text-xs sm:flex-row sm:text-sm">
                    <p>&copy; 2025–2026 สำนักงานสาธารณสุขจังหวัดสตูล - All Rights Reserved</p>
                    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-end">
                        <SiteViewCounter className="text-gray-300" />
                        <Link href="/login" className="text-gray-400 hover:text-white">เข้าสู่ระบบเจ้าหน้าที่</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
