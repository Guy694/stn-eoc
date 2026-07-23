export default function EmptyState({ title = "ยังไม่มีข้อมูล", description }) {
  return (
    <div className="border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <p className="font-bold text-slate-700">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}
