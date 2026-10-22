'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowUp, Clock, Database, EyeOff, FileClock, Mail, MapPin, Phone, RefreshCw, Scale, Share2, ShieldCheck, Smartphone, Target, UserCheck
} from 'lucide-react';
import PublicOpsScaffold from '@/components/public/PublicOpsScaffold';
import PrivacyPublicServices from '@/components/public/PrivacyPublicServices';
import { PrivacyBullets, PrivacySection } from '@/components/public/PrivacySection';

// นโยบายความเป็นส่วนตัว (PDPA) — ใช้แถบหัว/ธีมเดียวกับหน้าประชาชน
// มือถือ: สรุปสั้นด้านบน · สารบัญติดขอบบนและไฮไลต์หัวข้อที่กำลังอ่าน · หัวข้อละการ์ด · ปุ่มโทร/อีเมลขนาดนิ้วกด
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
  'เพื่อรักษาความปลอดภัยของระบบ เช่น ตรวจสอบการเข้าใช้งานผิดปกติจากที่อยู่ไอพีและตำแหน่งโดยประมาณของที่อยู่ไอพี',
  'เพื่อรายงานข้อมูลต่อหน่วยงานที่เกี่ยวข้อง',
  'เพื่อปฏิบัติตามกฎหมายและระเบียบที่เกี่ยวข้อง'
];

const RECIPIENTS = [
  'หน่วยงานราชการที่เกี่ยวข้องในการจัดการภัยพิบัติ',
  'หน่วยกู้ชีพและหน่วยงานฉุกเฉิน',
  'โรงพยาบาลและสถานพยาบาล',
  'องค์กรปกครองส่วนท้องถิ่น',
  'ผู้ให้บริการที่ระบบใช้ประมวลผลแทนศูนย์ฯ เฉพาะเท่าที่จำเป็น ได้แก่ ช่องแจ้งเตือนเจ้าหน้าที่ (Telegram) บริการ AI ของ Google (Gemini) สำหรับน้องสจ๊วต และ Google Translate เมื่อท่านเลือกแสดงหน้าเว็บเป็นภาษาอังกฤษ (ข้อความบนหน้าที่เปิดอยู่จะถูกส่งไปแปล)'
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

// สรุปสั้นจากเนื้อหาด้านล่าง (ไม่ใช่ข้อตกลงเพิ่มเติม)
const SUMMARY = [
  { icon: Target, text: 'ใช้ข้อมูลเท่าที่จำเป็นต่อการช่วยเหลือและรายงานสถานการณ์' },
  { icon: EyeOff, text: 'แผนที่สาธารณะไม่แสดงชื่อและเบอร์โทรของผู้แจ้ง' },
  { icon: Smartphone, text: 'ข้อมูลที่จำไว้ในเครื่อง ลบเองได้ที่หัวข้อ "ข้อมูลในเครื่อง"' }
];

const TOC = [
  ['collect', 'ข้อมูลที่เก็บ'],
  ['purpose', 'วัตถุประสงค์'],
  ['public-services', 'บริการประชาชน'],
  ['device-data', 'ข้อมูลในเครื่อง'],
  ['share', 'การเปิดเผย'],
  ['security', 'ความปลอดภัย'],
  ['retention', 'ระยะเวลาเก็บ'],
  ['rights', 'สิทธิของท่าน'],
  ['contact', 'ติดต่อ']
];

const TOC_IDS = TOC.map(([id]) => id);

/** หัวข้อที่กำลังอ่าน (ใช้ไฮไลต์สารบัญ) */
function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const visible = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => visible.set(entry.target.id, entry.isIntersecting));
      const first = ids.find((id) => visible.get(id));
      if (first) setActive(first);
    }, { rootMargin: '-64px 0px -55% 0px' });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

function Toc({ active }) {
  const listRef = useRef(null);
  // เลื่อนชิปของหัวข้อที่กำลังอ่านให้อยู่ในจอ (มือถือ)
  useEffect(() => {
    const list = listRef.current;
    const chip = list?.querySelector(`[data-toc="${active}"]`);
    if (!list || !chip || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: chip.offsetLeft - list.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
  }, [active]);
  return (
    <nav aria-label="สารบัญ" className="min-w-0 sticky top-0 z-20 -mx-4 border-b border-[#d6e3ea] bg-[#eef2f1]/95 backdrop-blur sm:-mx-6 lg:top-4 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:backdrop-blur-none">
      <p className="hidden px-3 pb-2 text-xs font-semibold text-slate-500 lg:block">ในหน้านี้</p>
      <ul ref={listRef} className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-6 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:py-0 [&::-webkit-scrollbar]:hidden">
        {TOC.map(([id, label]) => {
          const on = active === id;
          return (
            <li key={id} className="shrink-0">
              <a
                href={`#${id}`}
                data-toc={id}
                aria-current={on ? 'true' : undefined}
                className={`block rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition-colors lg:rounded-lg lg:px-3 lg:ring-0 ${on ? 'bg-[#0c2f4a] text-white ring-[#0c2f4a] lg:bg-white lg:text-[#0c2f4a] lg:shadow-sm' : 'bg-white text-[#11466e] ring-[#d6e3ea] hover:ring-[#2a9db0] lg:bg-transparent lg:hover:bg-white'}`}
              >
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function PrivacyPolicyPage() {
  const active = useActiveSection(TOC_IDS);
  return (
    <PublicOpsScaffold title="นโยบายความเป็นส่วนตัว" activeMenu="" showPageHeader={false} mainClassName="p-0!">
      <div className="bg-[#eef2f1] font-[family-name:var(--font-kanit)]">
        <header className="bg-[#0c2f4a] text-white">
          <div className="mx-auto max-w-5xl px-4 pb-6 pt-5 sm:px-6 sm:pb-12 sm:pt-6">
            <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#9fc9d6] hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> กลับหน้าแรก
            </Link>
            <h1 className="mt-2 text-[1.7rem] font-semibold leading-tight sm:mt-4 sm:text-4xl">นโยบายความเป็นส่วนตัว</h1>
            <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-[#c9dde6] sm:mt-3 sm:text-base">
              ศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล ใช้ข้อมูลของท่านเท่าที่จำเป็นต่อการช่วยเหลือ
              ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
            </p>
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#9fc9d6] sm:text-sm">
              <span>มีผลบังคับใช้ 1 ม.ค. 2567</span>
              <span>ปรับปรุงล่าสุด 7 ต.ค. 2569</span>
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-3 sm:gap-3" aria-label="สรุปสั้น">
              {SUMMARY.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 rounded-xl bg-white/[0.07] p-3 text-sm leading-snug text-[#e3eef3] ring-1 ring-white/10">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#5cc8db]" aria-hidden="true" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </header>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 pb-10 sm:px-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10 lg:py-8">
          <Toc active={active} />

          <article className="min-w-0 space-y-4 lg:space-y-8 lg:rounded-3xl lg:bg-white lg:p-9 lg:shadow-sm lg:ring-1 lg:ring-[#d6e3ea]">
            <PrivacySection id="collect" title="ข้อมูลที่เราเก็บรวบรวม" icon={Database}>
              <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
                {COLLECTED.map((group) => (
                  <div key={group.title} className="rounded-xl bg-[#f3f7f8] p-3.5 sm:bg-transparent sm:p-0">
                    <h3 className="mb-1.5 font-semibold text-[#0c2f4a]">{group.title}</h3>
                    <PrivacyBullets items={group.items} />
                  </div>
                ))}
              </div>
            </PrivacySection>

            <PrivacySection id="purpose" title="วัตถุประสงค์การใช้ข้อมูล" icon={Target}>
              <PrivacyBullets items={PURPOSES} />
            </PrivacySection>

            <PrivacyPublicServices />

            <PrivacySection id="share" title="การเปิดเผยข้อมูล" icon={Share2}>
              <p className="mb-2">เราอาจเปิดเผยข้อมูลส่วนบุคคลของท่านให้แก่</p>
              <PrivacyBullets items={RECIPIENTS} />
              <p className="mt-4 rounded-xl bg-[#f3f7f8] px-4 py-3 text-[0.95rem]">การเปิดเผยข้อมูลจะกระทำเฉพาะเท่าที่จำเป็นและเป็นไปตามกฎหมาย</p>
            </PrivacySection>

            <PrivacySection id="security" title="การรักษาความปลอดภัย" icon={ShieldCheck}>
              <PrivacyBullets items={SECURITY} />
            </PrivacySection>

            <PrivacySection id="retention" title="ระยะเวลาเก็บรักษาข้อมูล" icon={FileClock}>
              <p>
                เราจะเก็บรักษาข้อมูลส่วนบุคคลของท่านไว้เป็นระยะเวลา <strong className="text-[#0c2f4a]">5 ปี</strong> นับจากวันที่เก็บรวบรวม
                หรือตามระยะเวลาที่กฎหมายกำหนด หลังจากนั้นข้อมูลจะถูกลบหรือทำลายอย่างปลอดภัย
              </p>
              <p className="mt-2">
                ประวัติการเข้าชมเพื่อความปลอดภัย (ที่อยู่ไอพี ตำแหน่งโดยประมาณจากที่อยู่ไอพี หน้าที่เปิด และเวลา) เก็บไว้ <strong className="text-[#0c2f4a]">90 วัน</strong> แล้วลบอัตโนมัติ
                ระบบไม่ขอตำแหน่ง GPS จากอุปกรณ์ของท่านเพื่อการนี้
              </p>
            </PrivacySection>

            <PrivacySection id="rights" title="สิทธิของเจ้าของข้อมูล" icon={UserCheck}>
              <dl className="grid gap-2.5 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-4">
                {RIGHTS.map(([term, detail]) => (
                  <div key={term} className="rounded-xl bg-[#f3f7f8] px-4 py-3 sm:rounded-none sm:border-l-2 sm:border-[#2a9db0] sm:bg-transparent sm:py-0">
                    <dt className="font-semibold text-[#0c2f4a]">{term}</dt>
                    <dd className="text-[0.95rem] leading-relaxed text-slate-600">{detail}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                <Scale className="mt-0.5 h-4 w-4 shrink-0 text-[#2a9db0]" aria-hidden="true" />
                ใช้สิทธิได้โดยติดต่อศูนย์ฯ ตามช่องทางในหัวข้อถัดไป
              </p>
            </PrivacySection>

            <PrivacySection id="contact" title="ติดต่อเพื่อใช้สิทธิหรือสอบถาม" icon={Phone}>
              <div className="rounded-2xl bg-[#0c2f4a] p-4 text-white sm:p-6">
                <p className="font-semibold leading-snug">ศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข (EOC) จังหวัดสตูล</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <a href="tel:074711501" className="flex min-h-12 items-center gap-3 rounded-xl bg-white/10 px-4 font-semibold hover:bg-white/15">
                    <Phone className="h-5 w-5 shrink-0 text-[#5cc8db]" aria-hidden="true" /> 074-711-501
                  </a>
                  <a href="mailto:eoc@satun.go.th" className="flex min-h-12 items-center gap-3 rounded-xl bg-white/10 px-4 font-semibold hover:bg-white/15">
                    <Mail className="h-5 w-5 shrink-0 text-[#5cc8db]" aria-hidden="true" /> eoc@satun.go.th
                  </a>
                </div>
                <ul className="mt-3 space-y-1.5 text-[0.95rem] text-[#c9dde6]">
                  <li className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-[#5cc8db]" aria-hidden="true" /> ศาลากลางจังหวัดสตูล</li>
                  <li className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0 text-[#5cc8db]" aria-hidden="true" /> จันทร์–ศุกร์ 08:30–16:30 น.</li>
                </ul>
              </div>
            </PrivacySection>

            <PrivacySection id="updates" title="การปรับปรุงนโยบาย" icon={RefreshCw}>
              <p>เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว การเปลี่ยนแปลงที่สำคัญจะแจ้งให้ท่านทราบผ่านทางเว็บไซต์หรือช่องทางอื่นที่เหมาะสม</p>
            </PrivacySection>

            <a href="#top-of-policy" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#11466e] hover:bg-white lg:hidden">
              <ArrowUp className="h-4 w-4" aria-hidden="true" /> กลับขึ้นด้านบน
            </a>
          </article>
        </div>
      </div>
    </PublicOpsScaffold>
  );
}
