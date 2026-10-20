// ลบบัญชีเจ้าหน้าที่หลายคน: เรียก API ทีละคน (ใช้เงื่อนไขฝั่งเซิร์ฟเวอร์เดียวกับการลบทีละคน)
// คืน { deleted, withHistory, failed } — คนที่มีประวัติการทำงานลบไม่ได้ ให้หน้าเว็บเสนอระงับการใช้งานแทน
export async function deleteOfficersInBatch(officers = [], removeOne) {
  const deleted = [];
  const withHistory = [];
  const failed = [];
  for (const officer of officers) {
    try {
      await removeOne(officer);
      deleted.push(officer);
    } catch (error) {
      if (error?.payload?.code === "HAS_HISTORY") withHistory.push(officer);
      else failed.push({ officer, message: error?.message || "ลบไม่สำเร็จ" });
    }
  }
  return { deleted, withHistory, failed };
}
