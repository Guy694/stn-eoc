import { redirect } from "next/navigation";

// รวมเข้าหน้า "ศูนย์พักพิง" หน้าเดียว (แท็บแผนที่) เพื่อไม่ให้มีสองหน้าที่ทำเรื่องเดียวกัน
export default function FloodSheltersRedirect() {
  redirect("/eoc/shelters?eoc=flood&tab=map");
}
