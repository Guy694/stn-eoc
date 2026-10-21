"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Biohazard, Droplets, Earth, ImagePlus, RefreshCw, Sun, Trash2, Upload, Waves, X } from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { useAuth } from "@/context/AuthContext";
import { AdminPage, Button, useNotice } from "@/components/admin/crud";
import PaginationControls, { usePagination } from "@/components/common/PaginationControls";
import { showDeleteConfirm } from "@/lib/sweetAlert";
import { formatDateTime } from "@/lib/adminApi";

// คลังภาพอินโฟกราฟิกของฝ่ายสื่อสารความเสี่ยง แยกตามประเภทภัย
const EOC_TYPES = [
  { value: "flood", label: "อุทกภัย", icon: Droplets },
  { value: "drought", label: "ภัยแล้ง", icon: Sun },
  { value: "tsunami", label: "สึนามิ", icon: Waves },
  { value: "earthquake", label: "แผ่นดินไหว", icon: Earth },
  { value: "disease", label: "โรคระบาด", icon: Biohazard },
];
const MAX_MB = 10;
const ACCEPT = ["image/png", "image/jpeg"];
const typeLabel = (value) => EOC_TYPES.find((type) => type.value === value)?.label || value;
const fileSize = (bytes) => (Number(bytes) >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(Number(bytes || 0) / 1024))} KB`);

export default function UploadInfographics() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { success, fail } = useNotice();
  const inputRef = useRef(null);
  const [assets, setAssets] = useState(null);
  const [uploadType, setUploadType] = useState("flood");
  const [filter, setFilter] = useState("all");
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) router.replace(user ? "/dashboard" : "/login");
  }, [authLoading, router, user]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/stn-eoc/api/admin/infographics/list");
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "โหลดรายการไฟล์ไม่สำเร็จ");
      setAssets(data.assets || []);
    } catch (error) {
      fail(error.message);
      setAssets([]);
    }
  }, [fail]);
  const isAdmin = user?.role === "admin";
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const counts = useMemo(() => (assets || []).reduce((acc, row) => ({ ...acc, [row.eoc_type]: (acc[row.eoc_type] || 0) + 1 }), {}), [assets]);
  const shown = useMemo(() => (assets || []).filter((row) => filter === "all" || row.eoc_type === filter), [assets, filter]);
  const { anchor: galleryAnchor, ...paged } = usePagination(shown, { pageSize: 12, resetKey: filter });

  // เลือกไฟล์: กันไฟล์ผิดประเภท/ใหญ่เกินตั้งแต่ก่อนอัปโหลด
  const pick = (list) => {
    const chosen = Array.from(list || []);
    const bad = chosen.filter((file) => !ACCEPT.includes(file.type) || file.size > MAX_MB * 1024 * 1024);
    if (bad.length) fail(`ข้ามไฟล์ที่ไม่ใช่ PNG/JPG หรือใหญ่เกิน ${MAX_MB} MB: ${bad.map((file) => file.name).join(", ")}`);
    const ok = chosen.filter((file) => !bad.includes(file));
    setFiles((current) => [...current, ...ok.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };
  const removePicked = (index) => setFiles((current) => {
    URL.revokeObjectURL(current[index].url);
    return current.filter((_, i) => i !== index);
  });
  const clearPicked = () => setFiles((current) => {
    current.forEach((item) => URL.revokeObjectURL(item.url));
    return [];
  });
  // ออกจากหน้า: คืนหน่วยความจำของภาพตัวอย่างที่ยังค้าง
  const pickedRef = useRef(files);
  useEffect(() => { pickedRef.current = files; }, [files]);
  useEffect(() => () => pickedRef.current.forEach((item) => URL.revokeObjectURL(item.url)), []);

  const upload = async () => {
    if (!files.length) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("eocType", uploadType);
      files.forEach((item) => body.append("files", item.file));
      const response = await fetch("/stn-eoc/api/admin/infographics/upload", { method: "POST", body });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "อัปโหลดไม่สำเร็จ");
      success(`อัปโหลด ${files.length} ไฟล์เข้าหมวด${typeLabel(uploadType)}แล้ว`);
      clearPicked();
      if (inputRef.current) inputRef.current.value = "";
      setFilter(uploadType);
      await load();
    } catch (error) {
      fail(error.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (row) => {
    if (!await showDeleteConfirm(`ลบ "${row.original_filename || row.stored_filename}" ออกจากคลังภาพหรือไม่ ลบแล้วกู้คืนไม่ได้`)) return;
    try {
      const response = await fetch("/stn-eoc/api/admin/infographics/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eocType: row.eoc_type, filename: row.stored_filename }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "ลบไม่สำเร็จ");
      success("ลบไฟล์แล้ว");
      await load();
    } catch (error) {
      fail(error.message);
    }
  };

  if (authLoading || !user || user.role !== "admin") return <div className="grid min-h-screen place-items-center text-sm text-slate-500">กำลังตรวจสอบสิทธิ์...</div>;

  return (
    <EOCLayout>
      <AdminPage
        title="คลังอินโฟกราฟิก"
        description="ภาพที่อัปโหลดจะแสดงในหน้า &quot;ประกาศและความรู้&quot; ของประชาชนทันที แยกหมวดตามประเภทภัย ตั้งชื่อไฟล์ให้อ่านรู้เรื่อง เพราะใช้เป็นชื่อภาพ"
        actions={<Button variant="secondary" onClick={load}><RefreshCw className="h-4 w-4" aria-hidden="true" />รีเฟรช</Button>}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="upload-title">
          <h2 id="upload-title" className="text-base font-black text-slate-900">อัปโหลดภาพใหม่</h2>
          <fieldset className="mt-3">
            <legend className="text-sm font-bold text-slate-800">ประเภทภัย</legend>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="ประเภทภัย">
              {EOC_TYPES.map((type) => {
                const Icon = type.icon;
                const on = uploadType === type.value;
                return (
                  <button key={type.value} type="button" role="radio" aria-checked={on} onClick={() => setUploadType(type.value)}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 text-sm font-bold ring-1 transition ${on ? "bg-[#0b4c86] text-white ring-[#0b4c86]" : "bg-white text-slate-700 ring-slate-300 hover:bg-[#edf5fc]"}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />{type.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); pick(event.dataTransfer.files); }}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${dragging ? "border-[#0b4c86] bg-[#edf5fc]" : "border-slate-300 hover:border-[#0b4c86] hover:bg-slate-50"}`}>
            <ImagePlus className="h-8 w-8 text-[#0b4c86]" aria-hidden="true" />
            <span className="mt-2 font-bold text-slate-900">ลากภาพมาวาง หรือกดเพื่อเลือกไฟล์</span>
            <span className="mt-0.5 text-sm text-slate-500">PNG หรือ JPG ไม่เกิน {MAX_MB} MB ต่อไฟล์ เลือกได้หลายไฟล์</span>
            <input ref={inputRef} type="file" accept={ACCEPT.join(",")} multiple className="sr-only" onChange={(event) => { pick(event.target.files); event.target.value = ""; }} />
          </label>

          {files.length ? (
            <div className="mt-4">
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
                {files.map((item, index) => (
                  <li key={item.url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- ภาพตัวอย่างจากเครื่องผู้ใช้ (blob:) */}
                    <img src={item.url} alt="" className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200" />
                    <p className="mt-1 truncate text-xs text-slate-600" title={item.file.name}>{item.file.name}</p>
                    <button type="button" onClick={() => removePicked(index)} aria-label={`เอา ${item.file.name} ออก`}
                      className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-700 shadow hover:bg-white"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <Button variant="secondary" onClick={clearPicked} disabled={uploading}>ล้างที่เลือก</Button>
                <Button onClick={upload} disabled={uploading}><Upload className="h-4 w-4" aria-hidden="true" />{uploading ? "กำลังอัปโหลด…" : `อัปโหลด ${files.length} ไฟล์เข้าหมวด${typeLabel(uploadType)}`}</Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white" aria-labelledby="gallery-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <h2 id="gallery-title" className="text-base font-black text-slate-900">ภาพในคลัง {assets ? <span className="text-sm font-semibold text-slate-500">({assets.length.toLocaleString("th-TH")} ภาพ)</span> : null}</h2>
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="กรองตามประเภทภัย">
              {[{ value: "all", label: "ทั้งหมด" }, ...EOC_TYPES].map((type) => {
                const on = filter === type.value;
                const count = type.value === "all" ? assets?.length || 0 : counts[type.value] || 0;
                return (
                  <button key={type.value} type="button" role="tab" aria-selected={on} onClick={() => setFilter(type.value)}
                    className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${on ? "bg-[#edf5fc] text-[#0b4c86]" : "text-slate-600 hover:bg-slate-100"}`}>
                    {type.label} <span className="tabular-nums text-slate-400">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {assets === null ? (
            <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-100" />)}</div>
          ) : !shown.length ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">{filter === "all" ? "ยังไม่มีภาพในคลัง อัปโหลดภาพแรกได้ที่ด้านบน" : `ยังไม่มีภาพหมวด${typeLabel(filter)}`}</p>
          ) : (
            <>
              <ul ref={galleryAnchor} className="grid scroll-mt-4 grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
                {paged.visible.map((row) => {
                  const src = `/stn-eoc/infographics/${row.eoc_type}/${row.stored_filename}`;
                  const name = row.original_filename || row.stored_filename;
                  return (
                    <li key={row.id} className="flex flex-col overflow-hidden rounded-xl ring-1 ring-slate-200">
                      <a href={src} target="_blank" rel="noreferrer" className="block bg-slate-50" title="เปิดภาพขนาดเต็ม">
                        <Image src={src} alt={name} width={320} height={200} className="h-40 w-full object-cover" unoptimized />
                      </a>
                      <div className="flex flex-1 items-start gap-2 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-900" title={name}>{name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{typeLabel(row.eoc_type)} · {formatDateTime(row.created_at)} · {fileSize(row.file_size)}</p>
                        </div>
                        <button type="button" onClick={() => remove(row)} aria-label={`ลบ ${name}`} title="ลบ"
                          className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <PaginationControls {...paged.controls} pageSizeOptions={[12, 24, 48]} itemLabel="ภาพ" className="rounded-b-2xl border-t border-slate-100 bg-slate-50" />
            </>
          )}
        </section>
      </AdminPage>
    </EOCLayout>
  );
}
