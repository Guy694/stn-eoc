export async function getSatAssignments({ signal } = {}) {
  const response = await fetch("/stn-eoc/api/user/my-assignments/", { signal });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถโหลดข้อมูลงาน SAT ได้");
  return result.assignments || [];
}
