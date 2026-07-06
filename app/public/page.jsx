import Link from "next/link";
import PublicOpsScaffold from "@/components/public/PublicOpsScaffold";

const QUICK_LINKS = [
  {
    href: "/public/disaster-map",
    title: "แผนที่สถานการณ์",
    desc: "ดูจุดเหตุการณ์ พื้นที่เสี่ยง และชั้นข้อมูลสำคัญแบบเรียลไทม์",
    tone: "from-blue-500 to-cyan-500"
  },
  {
    href: "/public/announcements",
    title: "ประกาศล่าสุด",
    desc: "ติดตามข่าวเตือนภัย คำแนะนำ และประกาศจากหน่วยงาน",
    tone: "from-amber-500 to-orange-500"
  },
  {
    href: "/public/shelters",
    title: "ศูนย์พักพิง",
    desc: "ค้นหาศูนย์พักพิงที่เปิดใช้งาน ความจุ และเส้นทางเดินทาง",
    tone: "from-emerald-500 to-teal-500"
  },
  {
    href: "/public/agencies",
    title: "หน่วยงานสำคัญ",
    desc: "รวมเบอร์ฉุกเฉินและช่องทางติดต่อหน่วยงานในจังหวัดสตูล",
    tone: "from-violet-500 to-indigo-500"
  }
];

export default function PublicHomePage() {
  return (
    <PublicOpsScaffold
      title="หน้าหลักข้อมูลสาธารณะ"
      subtitle="ติดตามสถานการณ์ฉุกเฉิน ข่าวประกาศ และการช่วยเหลือได้จากจุดเดียว"
      activeMenu="home"
      showPageHeader
    >
      <section className="grid gap-4 md:grid-cols-2">
        {QUICK_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={`h-1.5 w-24 rounded-full bg-gradient-to-r ${item.tone}`} />
            <h3 className="mt-4 text-xl font-black text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
            <p className="mt-4 text-sm font-bold text-blue-700 group-hover:text-blue-900">เปิดหน้าข้อมูล</p>
          </Link>
        ))}
      </section>

      <section className="mt-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-5">
        <h3 className="text-lg font-black text-blue-900">EOC Assistant พร้อมใช้งาน</h3>
        <p className="mt-1 text-sm text-blue-800">
          กดเมนู EOC Assistant หรือปุ่มบอทมุมขวาล่างเพื่อสอบถามข้อมูลสาธารณะได้ทุกหน้า
        </p>
      </section>
    </PublicOpsScaffold>
  );
}
