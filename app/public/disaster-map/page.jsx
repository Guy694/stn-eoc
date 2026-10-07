import DisasterMapWorkspace from "@/components/public/disaster-map/DisasterMapWorkspace";

export const metadata = {
  title: "แผนที่สถานการณ์ | Satun Geo-EOC",
  description: "แผนที่สถานการณ์ตอนนี้ของจังหวัดสตูล: พื้นที่น้ำท่วม ระดับน้ำในคลอง ฝนที่วัดได้ รายงานจากประชาชน ศูนย์พักพิง โรคระบาด และเรดาร์ฝน"
};

const MAP_TYPES = new Set(["flood", "disease", "accident"]);

export default async function PublicDisasterMapPage({ searchParams }) {
  const params = await searchParams;
  const type = MAP_TYPES.has(params?.type) ? params.type : "flood";
  return <DisasterMapWorkspace key={type} initialDisasterType={type} />;
}
