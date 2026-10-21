"use client";

import Link from "next/link";
import EOCLayout from "@/components/layouts/EOCLayout";
import { PageHero } from "@/components/common/ThemePanels";
import { createTeamNavigation } from "@/src/config/navigation/eoc-navigation";
import { getEocType } from "../../registries/eoc-type.registry";
import { getTeam } from "../../registries/team.registry";

// โครงหน้าของกลุ่มภารกิจ (ภาพรวม/สมาชิก/บันทึก) — หัวหน้าน้ำเงินแบบเดียวกับหน้าอื่นของระบบ + แท็บเมนูของกลุ่ม
export default function TeamPageShell({ eocType, teamCode, activeSection, children }) {
  const eoc = getEocType(eocType);
  const team = getTeam(teamCode);
  const navigation = createTeamNavigation(eocType, teamCode);

  return (
    <EOCLayout>
      <section className="mx-auto max-w-7xl space-y-4">
        <PageHero icon="users" eyebrow={`EOC ${eoc?.name || ""} › กลุ่มภารกิจ`} title={team?.name || "กลุ่มภารกิจ"} subtitle={team?.shortName ? `ทีม ${team.shortName}` : null} />
        <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 font-[family-name:var(--font-kanit)]" aria-label="เมนูกลุ่มภารกิจ">
          {navigation.map((item) => {
            const active = activeSection === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${active ? "bg-[#0b4c86] text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </section>
    </EOCLayout>
  );
}
