"use client";

// ส่งต่อคำเตือนทาง LINE (หรือแอปอื่นผ่านเมนูแชร์ของมือถือ)
import { Share2 } from "lucide-react";

export function lineShareUrl(text, url) {
  return `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export default function ShareLineButton({ text, path = "/stn-eoc/", className = "", children = "ส่งต่อทาง LINE" }) {
  const onClick = async (event) => {
    const url = new URL(path, window.location.origin).toString();
    if (typeof navigator !== "undefined" && navigator.share) {
      event.preventDefault();
      try {
        await navigator.share({ title: "เตือนภัย จ.สตูล", text, url });
      } catch {
        // ผู้ใช้ยกเลิก
      }
    } else {
      event.currentTarget.href = lineShareUrl(text, url);
    }
  };
  return (
    <a href={lineShareUrl(text, path)} onClick={onClick} target="_blank" rel="noopener noreferrer" className={className}>
      <Share2 className="h-4 w-4" aria-hidden="true" />{children}
    </a>
  );
}
