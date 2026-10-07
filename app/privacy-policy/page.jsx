'use client';

import Link from 'next/link';
import { ArrowLeft, Mail, MapPin, Phone, Clock } from 'lucide-react';
import PublicOpsScaffold from '@/components/public/PublicOpsScaffold';
import PrivacyPublicServices from '@/components/public/PrivacyPublicServices';

// นโยบายความเป็นส่วนตัว (PDPA) — ใช้แถบหัว/ธีมเดียวกับหน้าประชาชน
const COLLECTED = [
  { title: 'ข้อมูลส่วนบุคคล', items: ['ชื่อ-นามสกุล', 'เบอร์โทรศัพท์', 'ที่อยู่ (หมู่บ้าน ตำบล อำเภอ)', 'พิกัดทางภูมิศาสตร์'] },
  { title: 'ข้อมูลเหตุการณ์', items: ['รายละเอียดเหตุการณ์ที่แจ้ง', 'รูปภาพประกอบ', 'วันเวลาที่เกิดเหตุ', 'ระดับความเร่งด่วน'] },
  { title: 'ข้อมูลการใช้งาน', items: ['ที่อยู่ไอพี', 'ประเภทและเวอร์ชันของเบราว์เซอร์', 'Cookies และ Local Storage', 'ประวัติการเข้าใช้งานระบบ'] }
];

const PURPOSES = [
  'เพื่อติดต่อและให้ความช่วยเหลือในกรณีฉุกเฉิน',
  'เพื่อประมวลผลและวิเคราะห์สถานการณ์ภัยพิบัติ',
  'เพื่อจัดทำรายงานและสถิติเหตุการณ์',
  'เพื่อปรับปรุงและพัฒนาระบบให้มีประสิทธิภาพ',
  'เพื่อรายงานข้อมูลต่อหน่วยงานที่เกี่ยวข้อง',
  'เพื่อปฏิบัติตามกฎหมายและระเบียบที่เกี่ยวข้อง'
];

const RECIPIENTS = [
  'หน่วยงานราชการที่เกี่ยวข้องในการจัดการภัยพิบัติ',
  'หน่วยกู้ชีพและหน่วยงานฉุกเฉิน',
  'โรงพยาบาลและสถานพยาบาล',
  'องค์กรปกครองส่วนท้องถิ่น',
  'ผู้ให้บริการที่ระบบใช้ประมวลผลแทนศูนย์ฯ เฉพาะเท่าที่จำเป็น ได้แก่ ช่องแจ้งเตือนเจ้าหน้าที่ (Telegram) และบริการ AI ของ Google (Gemini) สำหรับผู้ช่วย EOC'
];

const SECURITY = [
  'การเข้ารหัสข้อมูล',
  'การควบคุมการเข้าถึงข้อมูล',
  'การสำรองข้อมูลอย่างสม่ำเสมอ',
  'การตรวจสอบและบันทึกการเข้าถึงระบบ (บันทึกการตรวจสอบ)',
  'การอบรมเจ้าหน้าที่เกี่ยวกับการคุ้มครองข้อมูล'
];

const RIGHTS = [
  ['สิทธิในการเข้าถึงข้อมูล', 'ขอเข้าถึงและขอรับสำเนาข้อมูลส่วนบุคคล'],
  ['สิทธิในการแก้ไขข้อมูล', 'ขอให้แก้ไขข้อมูลที่ไม่ถูกต้องหรือไม่สมบูรณ์'],
  ['สิทธิในการลบข้อมูล', 'ขอให้ลบข้อมูลส่วนบุคคล'],
  ['สิทธิในการระงับการใช้ข้อมูล', 'ขอให้ระงับการใช้ข้อมูลชั่วคราว'],
  ['สิทธิในการคัดค้าน', 'คัดค้านการประมวลผลข้อมูล'],
  ['สิทธิในการถอนความยินยอม', 'ถอนความยินยอมได้ตลอดเวลา']
];

const TOC = [
  ['collect', 'ข้อมูลที่เก็บ'],
  ['purpose', 'วัตถุประสงค์'],
  ['public-services', 'บริการประชาชน'],
  ['device-data', 'ข้อมูลในเครื่อง'],
  ['share', 'การเปิดเผย'],
  ['rights', 'สิทธิของท่าน'],
  ['contact', 'ติดต่อ']
];

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-[#d6e3ea] pt-8 first:border-t-0 first:pt-0">
      <h2 className="font-[family-name:var(--font-kanit)] text-2xl font-semibold text-[#0c2f4a]">{title}</h2>
      <div className="mt-4 text-[1.02rem] leading-8 text-slate-700">{children}</div>
    </section>
  );
}

function Bullets({ items }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2a9db0]" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <PublicOpsScaffold title="นโยบายความเป็นส่วนตัว" activeMenu="" showPageHeader={false} mainClassName="p-0!">
      <div className="bg-[#eef2f1]">
        <header className="bg-[#0c2f4a] text-white">
          <div className="mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6 sm:pb-12">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#9fc9d6] hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> กลับหน้าแรก
            </Link>
            <h1 className="mt-5 font-[family-name:var(--font-kanit)] text-3xl font-semibold sm:text-4xl">นโยบายความเป็นส่วนตัว</h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-[#c9dde6]">
              ศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล ใช้ข้อมูลของท่านเท่าที่จำเป็นต่อการช่วยเหลือ
              ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
            </p>
            <p className="mt-4 text-sm text-[#9fc9d6]">มีผลบังคับใช้ 1 มกราคม พ.ศ. 2567 • ปรับปรุงล่าสุด 7 ตุลาคม พ.ศ. 2569</p>
          </div>
        </header>

        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
          <nav aria-label="สารบัญ" className="lg:sticky lg:top-4 lg:self-start">
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
              {TOC.map(([id, label]) => (
                <li key={id} className="shrink-0">
                  <a href={`#${id}`} className="block rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-[#11466e] ring-1 ring-[#d6e3ea] hover:ring-[#2a9db0] lg:rounded-lg lg:bg-transparent lg:px-3 lg:ring-0 lg:hover:bg-white">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <article className="space-y-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#d6e3ea] sm:p-9">
            <Section id="collect" title="ข้อมูลที่เราเก็บรวบรวม">
              <div className="grid gap-5 sm:grid-cols-3">
                {COLLECTED.map((group) => (
                  <div key={group.title}>
                    <h3 className="mb-2 font-semibold text-[#0c2f4a]">{group.title}</h3>
                    <Bullets items={group.items} />
                  </div>
                ))}
              </div>
            </Section>

            <Section id="purpose" title="วัตถุประสงค์การใช้ข้อมูล">
              <Bullets items={PURPOSES} />
            </Section>

            <PrivacyPublicServices />

            <Section id="share" title="การเปิดเผยข้อมูล">
              <p className="mb-3">เราอาจเปิดเผยข้อมูลส่วนบุคคลของท่านให้แก่</p>
              <Bullets items={RECIPIENTS} />
              <p className="mt-4 rounded-xl bg-[#f3f7f8] px-4 py-3 text-[0.95rem]">การเปิดเผยข้อมูลจะกระทำเฉพาะเท่าที่จำเป็นและเป็นไปตามกฎหมาย</p>
            </Section>

            <Section id="security" title="การรักษาความปลอดภัย">
              <Bullets items={SECURITY} />
            </Section>

            <Section id="retention" title="ระยะเวลาเก็บรักษาข้อมูล">
              <p>
                เราจะเก็บรักษาข้อมูลส่วนบุคคลของท่านไว้เป็นระยะเวลา <strong className="text-[#0c2f4a]">5 ปี</strong> นับจากวันที่เก็บรวบรวม
                หรือตามระยะเวลาที่กฎหมายกำหนด หลังจากนั้นข้อมูลจะถูกลบหรือทำลายอย่างปลอดภัย
              </p>
            </Section>

            <Section id="rights" title="สิทธิของเจ้าของข้อมูล">
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {RIGHTS.map(([term, detail]) => (
                  <div key={term} className="border-l-2 border-[#2a9db0] pl-4">
                    <dt className="font-semibold text-[#0c2f4a]">{term}</dt>
                    <dd className="text-[0.95rem] text-slate-600">{detail}</dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section id="contact" title="ติดต่อเพื่อใช้สิทธิหรือสอบถาม">
              <div className="rounded-2xl bg-[#0c2f4a] p-5 text-white sm:p-6">
                <p className="font-semibold">ศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข (EOC) จังหวัดสตูล</p>
                <ul className="mt-3 grid gap-2 text-[0.95rem] text-[#c9dde6] sm:grid-cols-2">
                  <li className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-[#5cc8db]" aria-hidden="true" /> ศาลากลางจังหวัดสตูล</li>
                  <li className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-[#5cc8db]" aria-hidden="true" /> <a href="tel:074711501" className="text-white underline-offset-4 hover:underline">074-711-501</a></li>
                  <li className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-[#5cc8db]" aria-hidden="true" /> <a href="mailto:eoc@satun.go.th" className="text-white underline-offset-4 hover:underline">eoc@satun.go.th</a></li>
                  <li className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0 text-[#5cc8db]" aria-hidden="true" /> จันทร์–ศุกร์ 08:30–16:30 น.</li>
                </ul>
              </div>
            </Section>

            <Section id="updates" title="การปรับปรุงนโยบาย">
              <p>เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว การเปลี่ยนแปลงที่สำคัญจะแจ้งให้ท่านทราบผ่านทางเว็บไซต์หรือช่องทางอื่นที่เหมาะสม</p>
            </Section>
          </article>
        </div>
      </div>
    </PublicOpsScaffold>
  );
}
