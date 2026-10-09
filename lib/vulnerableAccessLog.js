// บันทึกการเข้าดู/แก้ไขข้อมูลกลุ่มเปราะบางรายบุคคล (ไม่เก็บค่าข้อมูล เก็บแค่ใคร ทำอะไร กับใคร เมื่อไร)
import { query } from "@/lib/db";
import { getClientIp } from "@/lib/clientIp";

export async function logVulnerableAccess({ request, user, action, sessionId = null, personId = null, count = null }) {
  try {
    await query(
      `INSERT INTO vulnerable_access_log (officer_id, officer_role, action, session_id, person_id, result_count, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user?.id ?? null, user?.role ?? null, action, sessionId, personId, count, request ? getClientIp(request) : null]
    );
  } catch (error) {
    console.warn("[vulnerable-access-log]", error?.message || error);
  }
}
