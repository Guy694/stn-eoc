"use client";

import { useCallback, useEffect, useState } from "react";

// เก็บแท็บ/ตัวเลือกไว้ใน query string (?tab=registry) เพื่อให้ลิงก์จากเมนูเปิดตรงแท็บ และกด back ได้
// (ไม่ใช้ useSearchParams เพื่อไม่ต้องห่อ Suspense ทุกหน้า)
export function readQuery(key) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

export function useUrlState(key, defaultValue, allowed) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const sync = () => {
      const fromUrl = readQuery(key);
      setValue(fromUrl && (!allowed || allowed.includes(fromUrl)) ? fromUrl : defaultValue);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, defaultValue]);

  const update = useCallback((next) => {
    setValue(next);
    const url = new URL(window.location.href);
    if (next === defaultValue) url.searchParams.delete(key);
    else url.searchParams.set(key, next);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event("stn:tab-change"));
  }, [defaultValue, key]);

  return [value, update];
}
