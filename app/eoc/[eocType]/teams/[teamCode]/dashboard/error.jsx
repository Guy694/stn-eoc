"use client";

export default function TeamDashboardError({ reset }) {
  return (
    <div className="min-h-screen bg-slate-100 p-8 text-center">
      <h1 className="text-xl font-black text-red-800">ไม่สามารถแสดง Dashboard ได้</h1>
      <button type="button" onClick={reset} className="mt-4 bg-cyan-700 px-4 py-2 text-sm font-bold text-white">ลองอีกครั้ง</button>
    </div>
  );
}
