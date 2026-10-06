import { redirect } from "next/navigation";

// รวมเข้ากับหน้าศูนย์พักพิงใหม่ (แท็บในเหตุการณ์)
export default function FloodShelterManageRedirect() {
  redirect("/eoc/shelters?eoc=flood");
}
