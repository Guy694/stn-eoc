import { optimizedImage, responsiveImage } from "@/lib/imageUrl";

describe("imageUrl", () => {
  const src = "/stn-eoc/uploads/announcements/a.png";

  it("ส่งรูปที่อัปโหลดผ่านตัวย่อรูป และปัดความกว้างขึ้นเป็นค่าที่ Next รับ", () => {
    expect(optimizedImage(src, 600)).toBe(`/stn-eoc/_next/image/?url=${encodeURIComponent(src)}&w=640&q=75`);
    expect(optimizedImage(src, 5000)).toContain("&w=3840&");
  });

  it("ไม่แตะรูปภายนอก SVG GIF หรือค่าว่าง", () => {
    expect(optimizedImage("https://x.test/a.png", 640)).toBe("https://x.test/a.png");
    expect(optimizedImage("/stn-eoc/img/logo.svg", 640)).toBe("/stn-eoc/img/logo.svg");
    expect(optimizedImage(null, 640)).toBeNull();
    expect(responsiveImage("//cdn.test/a.png", [640])).toEqual({ src: "//cdn.test/a.png" });
  });

  it("สร้าง srcSet เรียงจากเล็กไปใหญ่", () => {
    const image = responsiveImage(src, [1080, 640], "100vw");
    expect(image.srcSet.split(", ").map((part) => part.split(" ")[1])).toEqual(["640w", "1080w"]);
    expect(image.src).toContain("&w=1080&");
    expect(image.sizes).toBe("100vw");
  });
});
