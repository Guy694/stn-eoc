export default function SummaryCard({ label, value, detail }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 font-[family-name:var(--font-kanit)]">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-[#0c2f4a]">{value ?? "-"}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </article>
  );
}
