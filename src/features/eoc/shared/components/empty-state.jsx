export default function EmptyState({ title = "ยังไม่มีข้อมูล", description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center font-[family-name:var(--font-kanit)]">
      <p className="font-semibold text-slate-700">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}
