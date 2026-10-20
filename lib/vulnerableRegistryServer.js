// โหลดทะเบียนยอดรายหมู่บ้านที่รวมรายชื่อรายบุคคลแล้ว (ฝั่งเซิร์ฟเวอร์เท่านั้น)
import { query } from "@/lib/db";
import { TYPE_KEYS, mergeRegistry } from "@/lib/vulnerableRegistry";

const missing = (error) => error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR";

export async function loadMergedRegistry({ district, tambon } = {}) {
  const where = [];
  const params = [];
  if (district && district !== "all") { where.push("district = ?"); params.push(district); }
  if (tambon && tambon !== "all") { where.push("tambon = ?"); params.push(tambon); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [baseline, personGroups, villages] = await Promise.all([
    query(
      `SELECT id, province, district, tambon, village, ${TYPE_KEYS.join(", ")}, total_cared, moved, notes, needs, import_source, source_as_of_date, created_by, created_at, updated_at
       FROM vulnerable_group_baselines ${clause} ORDER BY district, tambon, village`, params
    ).catch((error) => (missing(error) ? [] : Promise.reject(error))),
    query(
      `SELECT district, tambon, village, vulnerable_type, COUNT(*) AS count FROM vulnerable_persons
       WHERE is_active = 1 ${where.length ? `AND ${where.join(" AND ")}` : ""} GROUP BY district, tambon, village, vulnerable_type`, params
    ).catch((error) => (missing(error) ? [] : Promise.reject(error))),
    query(`SELECT distname, subdistnam, moo, villname FROM satun_village_polygon WHERE moo IS NOT NULL`).catch(() => [])
  ]);
  return mergeRegistry(baseline, personGroups, villages);
}
