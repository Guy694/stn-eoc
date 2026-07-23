"use client";

import Link from "next/link";
import EOCLayout from "@/components/layouts/EOCLayout";
import { createTeamNavigation } from "@/src/config/navigation/eoc-navigation";
import { getEocType } from "../../registries/eoc-type.registry";
import { getTeam } from "../../registries/team.registry";

export default function TeamPageShell({ eocType, teamCode, activeSection, children }) {
  const eoc = getEocType(eocType);
  const team = getTeam(teamCode);
  const navigation = createTeamNavigation(eocType, teamCode);

  return (
    <EOCLayout>
      <section className="mx-auto max-w-7xl space-y-5">
        <header className="border-l-4 border-cyan-700 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-cyan-700">{team?.shortName}</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">{team?.name}</h1>
          <p className="mt-1 text-sm text-slate-600">EOC {eoc?.name}</p>
        </header>
        <nav className="flex overflow-x-auto border-b border-slate-200 bg-white" aria-label="เมนูกลุ่มภารกิจ">
          {navigation.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`shrink-0 border-b-2 px-5 py-3 text-sm font-bold ${activeSection === item.key ? "border-cyan-700 text-cyan-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {children}
      </section>
    </EOCLayout>
  );
}
