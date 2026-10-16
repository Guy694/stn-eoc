// จับคู่ผู้ใช้ Provider ID กับบัญชีเจ้าหน้าที่ (ไม่มีการเรียกเครือข่ายในไฟล์นี้)
// - เข้าสู่ระบบ: หาเจ้าหน้าที่ที่เคยเชื่อมบัญชีไว้ (account_id หรือ hash ของเลขบัตร) เท่านั้น ไม่จับคู่ด้วยชื่อ
// - เชื่อมบัญชี: เจ้าหน้าที่ที่เข้าสู่ระบบอยู่กดเชื่อมจากหน้าโปรไฟล์ (ยืนยันตัวตนกับระบบเราแล้ว)
import { protectHashCid } from "@/lib/providerId";

const OFFICER_FIELDS = "id, username, title, given_name, family_name, email, phone, role, is_approved, position, department, requested_role, provider_account_id";

export async function findLinkedOfficer(execute, profile) {
  const cidHmac = protectHashCid(profile.hashCid);
  const [rows] = await execute(
    `SELECT ${OFFICER_FIELDS} FROM officer
     WHERE (provider_account_id IS NOT NULL AND provider_account_id = ?) OR (provider_cid_hmac IS NOT NULL AND provider_cid_hmac = ?)
     ORDER BY (provider_account_id = ?) DESC LIMIT 2`,
    [profile.accountId || "", cidHmac || "", profile.accountId || ""]
  );
  return rows;
}

function linkValues(profile) {
  return [
    profile.accountId,
    protectHashCid(profile.hashCid),
    profile.providerId,
    profile.primaryOrg?.hcode || null,
    profile.primaryOrg?.name || null
  ];
}

/**
 * @returns {{ kind: "login", officer } | { kind: "linked", officer } | { kind: "error", code, message }}
 */
export async function resolveProviderLogin(execute, profile, { linkOfficerId = null } = {}) {
  if (!profile.accountId && !profile.hashCid) {
    return { kind: "error", code: "provider_profile", message: "Provider ID ไม่ได้ส่งรหัสบัญชีกลับมา" };
  }
  const matches = await findLinkedOfficer(execute, profile);

  if (linkOfficerId) {
    const other = matches.find((row) => Number(row.id) !== Number(linkOfficerId));
    if (other) {
      return { kind: "error", code: "provider_taken", message: "Provider ID นี้เชื่อมกับบัญชีเจ้าหน้าที่คนอื่นอยู่แล้ว ติดต่อผู้ดูแลระบบ" };
    }
    const [result] = await execute(
      `UPDATE officer SET provider_account_id = ?, provider_cid_hmac = ?, provider_id = ?, provider_hcode = ?, provider_org = ?, provider_linked_at = NOW()
       WHERE id = ?`,
      [...linkValues(profile), linkOfficerId]
    );
    if (!result?.affectedRows) return { kind: "error", code: "provider_link", message: "ไม่พบบัญชีเจ้าหน้าที่ที่จะเชื่อม" };
    const [rows] = await execute(`SELECT ${OFFICER_FIELDS} FROM officer WHERE id = ?`, [linkOfficerId]);
    return { kind: "linked", officer: rows[0] };
  }

  if (!matches.length) {
    return {
      kind: "error",
      code: "provider_not_linked",
      message: "บัญชี Provider ID นี้ยังไม่ได้เชื่อมกับบัญชีเจ้าหน้าที่ในระบบ เข้าสู่ระบบด้วยชื่อผู้ใช้หรือ ThaiD ก่อน แล้วกด “เชื่อม Provider ID” ที่หน้าโปรไฟล์"
    };
  }
  if (matches.length > 1 && Number(matches[0].id) !== Number(matches[1].id)) {
    return { kind: "error", code: "provider_taken", message: "Provider ID นี้ตรงกับบัญชีเจ้าหน้าที่มากกว่าหนึ่งบัญชี ติดต่อผู้ดูแลระบบ" };
  }
  const officer = matches[0];
  // ข้อมูลหน่วยงานล่าสุดจาก Provider ID (เผื่อย้ายหน่วยงาน)
  await execute(
    `UPDATE officer SET provider_account_id = COALESCE(provider_account_id, ?), provider_id = ?, provider_hcode = ?, provider_org = ?, last_login = NOW() WHERE id = ?`,
    [profile.accountId, profile.providerId, profile.primaryOrg?.hcode || null, profile.primaryOrg?.name || null, officer.id]
  );
  return { kind: "login", officer };
}
