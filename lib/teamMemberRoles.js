// บทบาทในทีมมี 2 แบบ: หัวหน้าทีม และ สมาชิกทีม
// ค่าเก่าในฐานข้อมูล (เช่น "หัวหน้า", "สมาชิก", "รองหัวหน้าทีม", "ผู้ประสานงาน", ค่าว่าง) แปลงเป็นค่ามาตรฐานผ่าน normalizeTeamMemberRole
export const TEAM_LEADER_ROLE = "หัวหน้าทีม";
export const TEAM_MEMBER_ROLE = "สมาชิกทีม";
export const TEAM_MEMBER_ROLES = [TEAM_MEMBER_ROLE, TEAM_LEADER_ROLE];

export function normalizeTeamMemberRole(value) {
  const role = String(value ?? "").trim();
  if (role.startsWith("รอง")) return TEAM_MEMBER_ROLE;
  if (role.startsWith("หัวหน้า")) return TEAM_LEADER_ROLE;
  return TEAM_MEMBER_ROLE;
}
