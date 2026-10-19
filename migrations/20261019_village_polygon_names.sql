-- ปรับชื่อหมู่บ้าน (villname) และเลขหมู่ (moo) ของ satun_village_polygon ให้ตรงทะเบียนหมู่บ้าน
-- แหล่งข้อมูล:
--   1) พิกัดหมู่บ้าน: กรมการปกครอง "ข้อมูลที่ตั้งและสภาพทั่วไปของหมู่บ้าน" (catalog.dopa.go.th/dataset/gis-01, ปรับปรุง มิ.ย. 2568)
--      ผ่านสำเนาใน github.com/wattanapongt63-byte/thailand-tambon-village-map — ใช้หาว่าหมู่บ้านใดอยู่ในแปลงไหน (point-in-polygon)
--   2) เลขหมู่: database/villages.sql (ชื่อตรงกับรายชื่อของกรมการปกครอง 273 จาก 280 หมู่บ้าน)
-- รายละเอียดทุกแปลง + เหตุผล: database/fixes/village-name-review-20261019.csv
-- ปลอดภัย: สำรองค่าเดิมไว้ในตาราง satun_village_polygon_name_backup_20261019 และอัปเดตเฉพาะแถวที่ชื่อ/หมู่เดิมยังตรงกับตอนตรวจ
-- moo = หมู่หลักของแปลง (แปลงที่คลุมหลายหมู่ ระบุชื่อทุกหมู่ใน villname) · เขตเทศบาลไม่มีเลขหมู่ → moo = NULL
-- ย้อนกลับ: UPDATE satun_village_polygon p JOIN satun_village_polygon_name_backup_20261019 b ON b.id = p.id SET p.villname = b.villname, p.moo = b.moo;

CREATE TABLE IF NOT EXISTS satun_village_polygon_name_backup_20261019 (
  id INT NOT NULL PRIMARY KEY,
  villname VARCHAR(100) NULL,
  moo VARCHAR(10) NULL,
  backed_up_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO satun_village_polygon_name_backup_20261019 (id, villname, moo)
SELECT id, villname, moo FROM satun_village_polygon;

UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 1 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 2 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลทุ่งหว้า', moo = NULL WHERE id = 4 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ทุ่งหว้า · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 5 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 6 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนท่านายเนาว์', moo = NULL WHERE id = 7 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'ท่าคลอง, โต๊ะยูด๊ะ', moo = '4' WHERE id = 8 AND villname <=> 'ท่าคลองเหนือ,โต๊ะยูด๊ะ' AND moo <=> NULL; -- ฉลุง · กลาง
UPDATE satun_village_polygon SET villname = 'วังประจันใต้, วังประจัน', moo = '4' WHERE id = 9 AND villname <=> 'วังประจันใต้' AND moo <=> '4'; -- วังประจัน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 10 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 11 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เกาะนก', moo = '3' WHERE id = 12 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลกำแพง', moo = NULL WHERE id = 13 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- กำแพง · สูง
UPDATE satun_village_polygon SET villname = 'จีน', moo = '2' WHERE id = 14 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ฉลุง · สูง
UPDATE satun_village_polygon SET villname = 'หลอมปืน, ปากละงู', moo = '14' WHERE id = 15 AND villname <=> 'หลอมปืน' AND moo <=> '14'; -- ละงู · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 16 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขาพญาบังสา, ปากบาง', moo = '1' WHERE id = 17 AND villname <=> 'พญาบังสา' AND moo <=> NULL; -- ย่านซื่อ · กลาง
UPDATE satun_village_polygon SET villname = 'ท่าแลหลา', moo = '2' WHERE id = 18 AND villname <=> 'ท่าแลหล่า' AND moo <=> '2'; -- กำแพง · กลาง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลกำแพง', moo = NULL WHERE id = 19 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- กำแพง · สูง
UPDATE satun_village_polygon SET villname = 'ท่าอ้อย', moo = '1' WHERE id = 20 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ทุ่งหว้า · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 21 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 22 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 23 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลทุ่งหว้า', moo = NULL WHERE id = 24 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ทุ่งหว้า · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 25 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนห้องสมุด', moo = NULL WHERE id = 26 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 28 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 29 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 30 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 31 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 32 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลเจ๊ะบิลัง', moo = NULL WHERE id = 33 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- เจ๊ะบิลัง · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนสี่แยกคอกเป็ด', moo = NULL WHERE id = 34 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 35 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 37 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขาจีน', moo = '1' WHERE id = 38 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 39 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 40 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 41 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'ควนโดน', moo = '1' WHERE id = 43 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ควนโดน · สูง
UPDATE satun_village_polygon SET villname = 'ท่าจีน', moo = '2' WHERE id = 45 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนบ้านโคกพยอม', moo = NULL WHERE id = 46 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 48 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'ฉลุงใต้, ท่าคลองใต้', moo = '1' WHERE id = 49 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ฉลุง · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลกำแพง', moo = NULL WHERE id = 51 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- กำแพง · สูง
UPDATE satun_village_polygon SET villname = 'วังเจริญราษฎร์', moo = '9' WHERE id = 52 AND villname <=> 'วังเจริญราษฏร์' AND moo <=> NULL; -- นาทอน · กลาง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 53 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'ซอย 10', moo = '2' WHERE id = 54 AND villname <=> 'ซอย 10 , คลองกลางปา' AND moo <=> NULL; -- ควนกาหลง · กลาง
UPDATE satun_village_polygon SET villname = 'ในบ้าน, โพธิ์', moo = '3' WHERE id = 55 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ทุ่งหว้า · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 56 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลกำแพง', moo = NULL WHERE id = 57 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- กำแพง · สูง
UPDATE satun_village_polygon SET villname = 'ดูสน', moo = '5' WHERE id = 59 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ควนโดน · สูง
UPDATE satun_village_polygon SET villname = 'ปาเต๊ะเหนือ', moo = '6' WHERE id = 60 AND villname <=> 'บันนังปูเลา,มานังปูเลา,ปาเต๊ะเหนือ' AND moo <=> NULL; -- เจ๊ะบิลัง · กลาง
UPDATE satun_village_polygon SET villname = 'ท่าเรือ', moo = '2' WHERE id = 62 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ทุ่งหว้า · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 63 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลกำแพง', moo = NULL WHERE id = 64 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- กำแพง · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลกำแพง', moo = NULL WHERE id = 69 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- กำแพง · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 70 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 71 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 72 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 73 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลควนโดน', moo = NULL WHERE id = 74 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ย่านซื่อ · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลควนโดน', moo = NULL WHERE id = 75 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ควนโดน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 78 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 79 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลทุ่งหว้า', moo = NULL WHERE id = 80 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ทุ่งหว้า · สูง
UPDATE satun_village_polygon SET villname = 'วังสายทอง, วังยาว', moo = '4' WHERE id = 81 AND villname <=> 'วังยาว , วังสายทอง' AND moo <=> NULL; -- น้ำผุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 82 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลกำแพง', moo = NULL WHERE id = 83 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- กำแพง · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 86 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 88 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 89 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'โต๊ะสะ', moo = '1' WHERE id = 90 AND villname <=> 'โต๊ะส๊ะ' AND moo <=> '1'; -- ควนสตอ · กลาง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลฉลุง', moo = NULL WHERE id = 91 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ฉลุง · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนชนาธิป', moo = NULL WHERE id = 92 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'ขอนคลานตะวันออก', moo = '1' WHERE id = 93 AND villname <=> 'ขอนคลาน, ขอนคลานตะวันออก' AND moo <=> NULL; -- ขอนคลาน · กลาง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 94 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลเจ๊ะบิลัง', moo = NULL WHERE id = 95 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- เจ๊ะบิลัง · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 96 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลกำแพง', moo = NULL WHERE id = 99 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- กำแพง · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนทุ่งเฉลิมตะวันออก', moo = NULL WHERE id = 100 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 101 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนซอยปลาเค็ม', moo = NULL WHERE id = 102 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 103 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 104 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนเมืองพิมาน', moo = NULL WHERE id = 105 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนโรงพระสามัคคี', moo = NULL WHERE id = 106 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลฉลุง', moo = NULL WHERE id = 107 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ฉลุง · สูง
UPDATE satun_village_polygon SET villname = 'เจ๊ะบิลัง', moo = '2' WHERE id = 109 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- เจ๊ะบิลัง · สูง
UPDATE satun_village_polygon SET villname = 'ท่าแลหลา', moo = '2' WHERE id = 110 AND villname <=> 'ท่าแลหล่า' AND moo <=> '2'; -- กำแพง · กลาง
UPDATE satun_village_polygon SET villname = 'ชุมชนเทศบาล4', moo = NULL WHERE id = 111 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 113 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'วัดหน้าเมือง', moo = '6' WHERE id = 115 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนบ้านศาลากันตง', moo = NULL WHERE id = 117 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 118 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'ซอย 10, ซอย 8, ซอยสาม', moo = '2' WHERE id = 119 AND villname <=> 'ซอย 8,9,10' AND moo <=> NULL; -- ควนกาหลง · กลาง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลควนโดน', moo = NULL WHERE id = 120 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ควนโดน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลควนโดน', moo = NULL WHERE id = 121 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ควนโดน · สูง
UPDATE satun_village_polygon SET villname = 'ซอย 10, ซอย 8', moo = '2' WHERE id = 122 AND villname <=> 'ซอย 8,9,10' AND moo <=> NULL; -- ควนกาหลง · กลาง
UPDATE satun_village_polygon SET villname = 'คลองขุดเหนือ', moo = '7' WHERE id = 123 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 124 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลกำแพง', moo = NULL WHERE id = 127 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- กำแพง · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลฉลุง', moo = NULL WHERE id = 128 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ฉลุง · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลกำแพง', moo = NULL WHERE id = 129 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- กำแพง · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนซอยม้าขาว', moo = NULL WHERE id = 130 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนทุ่งเฉลิมสุข, ชุมชนปานชูรำลึก', moo = NULL WHERE id = 131 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 132 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 133 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 135 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 136 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลกำแพง', moo = NULL WHERE id = 137 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- กำแพง · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลกำแพง', moo = NULL WHERE id = 138 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- กำแพง · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 139 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'ซอย 10', moo = '2' WHERE id = 140 AND villname <=> 'ซอย 10 , คลองกลางปา' AND moo <=> NULL; -- ควนกาหลง · กลาง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 141 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลควนโดน', moo = NULL WHERE id = 142 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ควนโดน · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนสัตยาราม', moo = NULL WHERE id = 143 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 144 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 145 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 147 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลเจ๊ะบิลัง', moo = NULL WHERE id = 148 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- เจ๊ะบิลัง · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 149 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 150 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'ควนสตอ, หัวควน', moo = '7' WHERE id = 151 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ควนสตอ · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนคลองเส็นเต็น, ชุมชนจงหัว', moo = NULL WHERE id = 152 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 153 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 154 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 157 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 158 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'คลองขุด', moo = '4' WHERE id = 159 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 160 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 161 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลเมืองสตูล', moo = NULL WHERE id = 162 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลเจ๊ะบิลัง', moo = NULL WHERE id = 163 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- เจ๊ะบิลัง · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 164 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'ปันจอร์, เกาะแอลัง', moo = NULL WHERE id = 165 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- ย่านซื่อ · สูง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 166 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'นาแค', moo = '5' WHERE id = 167 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'ควนใหญ่', moo = '4' WHERE id = 168 AND villname <=> 'ตลาดกำแพง,ควนใหญ่' AND moo <=> NULL; -- กำแพง · กลาง
UPDATE satun_village_polygon SET villname = 'เขตเทศบาลตำบลคลองขุด', moo = NULL WHERE id = 169 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- คลองขุด · สูง
UPDATE satun_village_polygon SET villname = 'ควน', moo = '3' WHERE id = 176 AND villname <=> 'ตลาดกำแพง,ควน' AND moo <=> NULL; -- กำแพง · กลาง
UPDATE satun_village_polygon SET villname = 'ควนโต๊ะ, เกาะไทร', moo = '2' WHERE id = 177 AND villname <=> 'ควนโต๊ะ' AND moo <=> '2'; -- แป-ระ · สูง
UPDATE satun_village_polygon SET villname = 'อุใดใต้', moo = '5' WHERE id = 178 AND villname <=> 'อุใดใต้, ผัง31' AND moo <=> NULL; -- อุใดเจริญ · กลาง
UPDATE satun_village_polygon SET villname = 'ซอยสาม, ซอย 4, ซอย 8', moo = '3' WHERE id = 179 AND villname <=> 'ซอย 3 ,ควนกาหลง' AND moo <=> NULL; -- ควนกาหลง · กลาง
UPDATE satun_village_polygon SET villname = 'จีน, เขาน้อย', moo = '2' WHERE id = 181 AND villname <=> 'จีน' AND moo <=> '2'; -- ฉลุง · กลาง
UPDATE satun_village_polygon SET villname = 'ซอยสาม', moo = '3' WHERE id = 182 AND villname <=> 'ซอย 3 ,ควนกาหลง' AND moo <=> NULL; -- ควนกาหลง · กลาง
UPDATE satun_village_polygon SET villname = 'เขาน้อย', moo = '3' WHERE id = 183 AND villname <=> 'เขาน้อยออก,เขาน้อย' AND moo <=> NULL; -- ย่านซื่อ · กลาง
UPDATE satun_village_polygon SET villname = 'อุใดใต้', moo = '5' WHERE id = 185 AND villname <=> 'อุใดใต้, ผัง31' AND moo <=> NULL; -- อุใดเจริญ · กลาง
UPDATE satun_village_polygon SET villname = 'เขาใคร, ปาล์มไทย', moo = '6' WHERE id = 186 AND villname <=> 'เขาไกร,เขาไคร' AND moo <=> NULL; -- ควนกาหลง · กลาง
UPDATE satun_village_polygon SET villname = 'ผัง 32,34,39', moo = '2' WHERE id = 187 AND villname <=> 'ผัง34,39' AND moo <=> NULL; -- อุใดเจริญ · สูง
UPDATE satun_village_polygon SET villname = 'ปาเต๊ะ', moo = '3' WHERE id = 188 AND villname <=> 'บาเต๊ะ' AND moo <=> NULL; -- เจ๊ะบิลัง · กลาง
UPDATE satun_village_polygon SET villname = 'ทุ่งปรือ', moo = '4' WHERE id = 189 AND villname <=> 'ทุ่งปรือ , ทุ่งเสม็ด' AND moo <=> NULL; -- ทุ่งหว้า · กลาง
UPDATE satun_village_polygon SET villname = 'หลีเป๊ะพัฒนา, เกาะอาดัง (เกาะลีเป๊ะ)', moo = '8' WHERE id = 199 AND villname <=> 'หลีเป๊ะพัฒนา' AND moo <=> '8'; -- เกาะสาหร่าย · กลาง
UPDATE satun_village_polygon SET villname = 'ผัง 8', moo = '4' WHERE id = 212 AND villname <=> 'ผัง 8,12,46' AND moo <=> NULL; -- นิคมพัฒนา · กลาง
UPDATE satun_village_polygon SET villname = 'แป-ระเหนือ, สวนเทศ', moo = '4' WHERE id = 213 AND villname <=> 'แป- ระเหนือ,เกาะละว้า,สวนเทศ' AND moo <=> NULL; -- แป-ระ · กลาง
UPDATE satun_village_polygon SET villname = 'ควนดินแดง, กะดุ', moo = '1' WHERE id = 217 AND villname <=> 'ควนดินแดง' AND moo <=> '1'; -- ควนขัน · กลาง
UPDATE satun_village_polygon SET villname = 'ห้วยน้ำดำ', moo = '1' WHERE id = 219 AND villname <=> 'ห้วยน้ำดำ,ควนกาหลง' AND moo <=> NULL; -- ควนกาหลง · กลาง
UPDATE satun_village_polygon SET villname = 'ควนเก, นาโต๊ะขุน', moo = '1' WHERE id = 220 AND villname <=> 'ควนเก' AND moo <=> '1'; -- แป-ระ · สูง
UPDATE satun_village_polygon SET villname = 'ตะโล๊ะน้ำ', moo = '6' WHERE id = 225 AND villname <=> 'ท่าแล,ตะโล๊ะน้ำ' AND moo <=> NULL; -- เกาะสาหร่าย · กลาง
UPDATE satun_village_polygon SET villname = 'ห้วยน้ำดำใน, ห้วยน้ำดำ', moo = '10' WHERE id = 228 AND villname <=> 'ห้วยน้ำดำใน' AND moo <=> '10'; -- ควนกาหลง · สูง
UPDATE satun_village_polygon SET villname = 'ควนไสน', moo = '1' WHERE id = 229 AND villname <=> 'ดอนไสน' AND moo <=> NULL; -- กำแพง · กลาง
UPDATE satun_village_polygon SET villname = 'เกาะอาดัง (เกาะลีเป๊ะ), หลีเป๊ะพัฒนา', moo = '7' WHERE id = 231 AND villname <=> 'เกาะลีเป๊ะ,เกาะอาคัง' AND moo <=> NULL; -- เกาะสาหร่าย · กลาง
UPDATE satun_village_polygon SET villname = 'ควนสตอ', moo = '7' WHERE id = 233 AND villname <=> 'เปลวโต๊ะแซว,ควนสะตอเหนือ,ควนสะตอ' AND moo <=> NULL; -- ควนสตอ · กลาง
UPDATE satun_village_polygon SET villname = 'ผัง 7', moo = '3' WHERE id = 236 AND villname <=> 'ผัง 7,10,45' AND moo <=> NULL; -- นิคมพัฒนา · กลาง
UPDATE satun_village_polygon SET villname = 'หัวเขา', moo = '9' WHERE id = 237 AND villname <=> 'หัวเขายามังสา,หัวเขา' AND moo <=> NULL; -- ฉลุง · กลาง
UPDATE satun_village_polygon SET villname = 'ห้วยน้ำดำ', moo = '1' WHERE id = 239 AND villname <=> 'ห้วยน้ำดำ,ควนกาหลง' AND moo <=> NULL; -- ควนกาหลง · กลาง
UPDATE satun_village_polygon SET villname = 'เกาะอาดัง (เกาะลีเป๊ะ)', moo = '7' WHERE id = 241 AND villname <=> 'เกาะลีเป๊ะ,เกาะอาคัง' AND moo <=> NULL; -- เกาะสาหร่าย · กลาง
UPDATE satun_village_polygon SET villname = 'ผัง 50', moo = '5' WHERE id = 245 AND villname <=> 'ผัง 50,47' AND moo <=> NULL; -- นิคมพัฒนา · กลาง
UPDATE satun_village_polygon SET villname = 'เขาน้อย', moo = '12' WHERE id = 249 AND villname <=> 'เขาน้อยออก,เขาน้อย' AND moo <=> NULL; -- ฉลุง · กลาง
UPDATE satun_village_polygon SET villname = 'ตะโละใส', moo = '4' WHERE id = 251 AND villname <=> 'ตะโล๊ะใส' AND moo <=> '4'; -- ปากน้ำ · กลาง
UPDATE satun_village_polygon SET villname = 'ตันหยงละไน้', moo = '1' WHERE id = 253 AND villname <=> 'ต้นหยงละไน้' AND moo <=> NULL; -- แหลมสน · กลาง
UPDATE satun_village_polygon SET villname = 'ซอย 4', moo = '4' WHERE id = 254 AND villname <=> 'ซอย 4,5,6, ทุ่งลำปาด' AND moo <=> NULL; -- ควนกาหลง · กลาง
UPDATE satun_village_polygon SET villname = 'ปิใหญ่', moo = '5' WHERE id = 255 AND villname <=> 'ปีใหญ่' AND moo <=> NULL; -- กำแพง · กลาง
UPDATE satun_village_polygon SET villname = 'เกาะเนียง, ใหม่', moo = '4' WHERE id = 256 AND villname <=> 'ใหม่,เกาะเนียง' AND moo <=> NULL; -- ควนโพธิ์ · สูง
UPDATE satun_village_polygon SET villname = 'ทุ่งวิมาน', moo = '2' WHERE id = 258 AND villname <=> 'ทุ่งวิมาน,ทุ่งโต๊ะกบ' AND moo <=> NULL; -- บ้านควน · กลาง
UPDATE satun_village_polygon SET villname = 'สาคร', moo = '2' WHERE id = 263 AND villname <=> 'ทุ่งสาคร' AND moo <=> NULL; -- สาคร · กลาง
UPDATE satun_village_polygon SET villname = 'ผัง 3,121', moo = '4' WHERE id = 264 AND villname <=> 'ผัง 3,5,121' AND moo <=> NULL; -- อุใดเจริญ · กลาง
UPDATE satun_village_polygon SET villname = 'ปากปิง', moo = '10' WHERE id = 265 AND villname <=> 'ปากปิ้ง' AND moo <=> '10'; -- กำแพง · กลาง
UPDATE satun_village_polygon SET villname = 'สาคร, ตื่น', moo = '2' WHERE id = 266 AND villname <=> 'สาครเหนือ ,ตื่น' AND moo <=> NULL; -- สาคร · กลาง
UPDATE satun_village_polygon SET villname = 'ผัง 13', moo = '7' WHERE id = 267 AND villname <=> 'ผัง 13,18' AND moo <=> NULL; -- นิคมพัฒนา · กลาง
UPDATE satun_village_polygon SET villname = 'ตะโละใส', moo = '4' WHERE id = 268 AND villname <=> 'ตะโล๊ะใส' AND moo <=> '4'; -- ปากน้ำ · กลาง
UPDATE satun_village_polygon SET villname = 'มุด', moo = '3' WHERE id = 271 AND villname <=> 'มุด, โต๊ะรัดแก้ว' AND moo <=> NULL; -- ท่าแพ · กลาง
UPDATE satun_village_polygon SET villname = 'ดาหลำ', moo = '5' WHERE id = 273 AND villname <=> 'เกาะแก้ว,ดาหลำ' AND moo <=> NULL; -- เขาขาว · กลาง
UPDATE satun_village_polygon SET villname = 'ซอย 4', moo = '4' WHERE id = 274 AND villname <=> 'ซอย 4,5,6, ทุ่งลำปาด' AND moo <=> NULL; -- ควนกาหลง · กลาง
UPDATE satun_village_polygon SET villname = 'เกาะเนียง, ใหม่', moo = '4' WHERE id = 278 AND villname <=> 'เกาะเนียง,ใหม่' AND moo <=> NULL; -- ควนโพธิ์ · สูง
UPDATE satun_village_polygon SET villname = 'กาลูบี', moo = '6' WHERE id = 279 AND villname <=> 'คลองน้ำพระ,กาลูบี' AND moo <=> NULL; -- บ้านควน · กลาง
UPDATE satun_village_polygon SET villname = 'โต๊ะเดาะ บ้านกาเนะ', moo = '1' WHERE id = 280 AND villname <=> 'ลูโบ๊ะบาตู' AND moo <=> NULL; -- บ้านควน · กลาง
UPDATE satun_village_polygon SET villname = 'ลูโบ๊ะกา.รายี', moo = '7' WHERE id = 281 AND villname <=> 'ลูโบ๊ะการายี' AND moo <=> NULL; -- บ้านควน · กลาง
UPDATE satun_village_polygon SET villname = 'สวนเทศ', moo = '5' WHERE id = 282 AND villname <=> 'สวนเทศ,คลองหมัง,ควนพัฒนา' AND moo <=> NULL; -- แป-ระ · กลาง
UPDATE satun_village_polygon SET villname = 'เนินสูง บ้านแรกอด บ้านควนขัน', moo = '5' WHERE id = 285 AND villname <=> 'เนินสูง' AND moo <=> NULL; -- ควนขัน · กลาง
UPDATE satun_village_polygon SET villname = 'ตะโละใส', moo = '4' WHERE id = 290 AND villname <=> 'ตะโล๊ะใส' AND moo <=> '4'; -- ปากน้ำ · กลาง
UPDATE satun_village_polygon SET villname = 'กะดุ, นาลาน', moo = '2' WHERE id = 292 AND villname <=> 'กะดุ' AND moo <=> '2'; -- ควนขัน · กลาง
UPDATE satun_village_polygon SET villname = 'ลาหงา, หัวทาง', moo = '4' WHERE id = 296 AND villname <=> 'ลาหงา,หัวทาง' AND moo <=> NULL; -- ละงู · สูง
UPDATE satun_village_polygon SET villname = 'วังช่อนชัย', moo = '17' WHERE id = 297 AND villname <=> 'วังช้อนชัย' AND moo <=> '17'; -- ละงู · กลาง
UPDATE satun_village_polygon SET villname = 'ควนยาหวา', moo = '3' WHERE id = 304 AND villname <=> 'ควรยาหวา' AND moo <=> NULL; -- ควนสตอ · กลาง
UPDATE satun_village_polygon SET villname = 'วังตง, วังเจริญราษฎร์', moo = '4' WHERE id = 305 AND villname <=> 'วังตง' AND moo <=> '4'; -- นาทอน · สูง
UPDATE satun_village_polygon SET villname = 'ริมห้วย, โคกประดู่', moo = '13' WHERE id = 308 AND villname <=> 'ริมห้วย' AND moo <=> '13'; -- ฉลุง · สูง
UPDATE satun_village_polygon SET villname = 'ปลักแรด, คลองสองปาก', moo = '5' WHERE id = 312 AND villname <=> 'คลองสองปาก,ปักแรด' AND moo <=> NULL; -- สาคร · กลาง
UPDATE satun_village_polygon SET villname = 'บาราเกตุ', moo = '10' WHERE id = 313 AND villname <=> 'คลองบาราเกตุ' AND moo <=> NULL; -- ควนโดน · กลาง
UPDATE satun_village_polygon SET villname = 'ผัง 1', moo = '1' WHERE id = 315 AND villname <=> 'ผัง 1,2' AND moo <=> NULL; -- อุใดเจริญ · กลาง
UPDATE satun_village_polygon SET villname = 'ลาหงา, หัวทาง', moo = '4' WHERE id = 316 AND villname <=> 'ลาหงา,หัวทาง' AND moo <=> NULL; -- ละงู · สูง
UPDATE satun_village_polygon SET villname = 'วังนาใน', moo = '10' WHERE id = 319 AND villname <=> 'วังน้ำใส , ในวัง , นาใน' AND moo <=> NULL; -- น้ำผุด · กลาง
UPDATE satun_village_polygon SET villname = 'ควนตำเสา, ทุ่งปรือ, ราวปลา', moo = '8' WHERE id = 320 AND villname <=> 'ควนตำเสา' AND moo <=> '8'; -- ทุ่งหว้า · สูง
UPDATE satun_village_polygon SET villname = 'ปาล์มทองพัฒนา, ปาล์ม 2', moo = '8' WHERE id = 322 AND villname <=> 'ปาล์มทองพัฒนา' AND moo <=> '8'; -- ปาล์มพัฒนา · สูง
UPDATE satun_village_polygon SET villname = 'ผัง 119,120', moo = '7' WHERE id = 323 AND villname <=> 'ผัง 120' AND moo <=> NULL; -- อุใดเจริญ · สูง
UPDATE satun_village_polygon SET villname = 'เกาะสาหร่าย (ยะระโตดใหญ่)', moo = '5' WHERE id = 324 AND villname <=> 'ยะระโตดใหญ่,เกาะสาหร่าย' AND moo <=> NULL; -- เกาะสาหร่าย · กลาง
UPDATE satun_village_polygon SET villname = 'เกาะไทร', moo = '3' WHERE id = 328 AND villname <=> 'เกาะไทร,เกาะโต๊ะ' AND moo <=> NULL; -- แป-ระ · กลาง
UPDATE satun_village_polygon SET villname = 'หาดทรายยาว, ตันหยงโป', moo = '2' WHERE id = 330 AND villname <=> 'หาดทรายยาว' AND moo <=> '2'; -- ตันหยงโป · สูง
UPDATE satun_village_polygon SET villname = 'ควนโต๊ะเหลง, สะพานเคียน', moo = '4' WHERE id = 331 AND villname <=> 'ควนโต๊ะเหลง,ตะบึงตึงงี' AND moo <=> NULL; -- ควนโดน · กลาง
UPDATE satun_village_polygon SET villname = 'มุด, ปลักหว้า', moo = '3' WHERE id = 335 AND villname <=> 'ปลักหว้า,มุด' AND moo <=> NULL; -- ท่าแพ · สูง
UPDATE satun_village_polygon SET villname = 'ทุ่งเกาะปราบ', moo = '6' WHERE id = 337 AND villname <=> 'ทุ่งเกาะบาป, ทุ่งเกาะปราบ' AND moo <=> NULL; -- เขาขาว · กลาง
UPDATE satun_village_polygon SET villname = 'บากันใหญ่พัฒนา', moo = '2' WHERE id = 338 AND villname <=> 'บางกันใหญ่' AND moo <=> NULL; -- เกาะสาหร่าย · กลาง
UPDATE satun_village_polygon SET villname = 'กุบังปะโหลด, ควนยาหวา', moo = '2' WHERE id = 340 AND villname <=> 'ปะโต๊ะโสม,กุบังปะโหลด' AND moo <=> NULL; -- ควนสตอ · กลาง
UPDATE satun_village_polygon SET villname = 'เขาน้อยตก, ควนโพธิ์, โคกไคร', moo = '1' WHERE id = 341 AND villname <=> 'ควนโพธิ์,เขาน้อยตก,ทุ่งหญ้าแดง' AND moo <=> NULL; -- ควนโพธิ์ · กลาง
UPDATE satun_village_polygon SET villname = 'นากลาง', moo = '2' WHERE id = 345 AND villname <=> 'นากลาง,เปรีย' AND moo <=> NULL; -- นาทอน · กลาง
UPDATE satun_village_polygon SET villname = 'ผัง 35', moo = '3' WHERE id = 346 AND villname <=> 'ผัง 33,35,41' AND moo <=> NULL; -- อุใดเจริญ · กลาง
UPDATE satun_village_polygon SET villname = 'ผัง 6, ผัง 7, ก้าวใหม่พัฒนา', moo = '1' WHERE id = 348 AND villname <=> 'ผัง 6,7' AND moo <=> NULL; -- นิคมพัฒนา · สูง
UPDATE satun_village_polygon SET villname = 'ปากคอก', moo = '6' WHERE id = 359 AND villname <=> 'ปากคอก,ป่าพน' AND moo <=> NULL; -- ปาล์มพัฒนา · กลาง
UPDATE satun_village_polygon SET villname = 'ดาหลำ, มุด', moo = '8' WHERE id = 361 AND villname <=> 'ดาหลำ' AND moo <=> '8'; -- ท่าแพ · สูง
UPDATE satun_village_polygon SET villname = 'กุบังปะโหลด', moo = '2' WHERE id = 364 AND villname <=> 'ปะโต๊ะโสม,กุบังปะโหลด' AND moo <=> NULL; -- ควนสตอ · กลาง
UPDATE satun_village_polygon SET villname = 'ตูแตหรำ', moo = '12' WHERE id = 369 AND villname <=> 'ป่าตุแตหล้า, ตูแตหรำ' AND moo <=> NULL; -- กำแพง · กลาง
UPDATE satun_village_polygon SET villname = 'กุบังปะโหลด, กลาง', moo = '2' WHERE id = 371 AND villname <=> 'กุนีงปะโหลด,กลาง' AND moo <=> NULL; -- ควนสตอ · กลาง
UPDATE satun_village_polygon SET villname = 'ควน, คลองตาย', moo = '5' WHERE id = 374 AND villname <=> 'ควน' AND moo <=> '5'; -- บ้านควน · สูง
UPDATE satun_village_polygon SET villname = 'ตูแตหรำ', moo = '12' WHERE id = 377 AND villname <=> 'ป่าตุแตหล้า, ตูแตหรำ' AND moo <=> NULL; -- กำแพง · กลาง
UPDATE satun_village_polygon SET villname = 'ทุ่งขมิ้น, เขาแดง', moo = '6' WHERE id = 378 AND villname <=> 'ทุ่งขมิ้น' AND moo <=> '6'; -- ป่าแก่บ่อหิน · สูง
UPDATE satun_village_polygon SET villname = 'ทุ่งนาแก้ว', moo = '5' WHERE id = 381 AND villname <=> 'ทุ่งนางแก้ว , ทุ่งบางแก้ว' AND moo <=> NULL; -- น้ำผุด · กลาง
UPDATE satun_village_polygon SET villname = 'อุใดเจริญ(ไร่สาธิต)', moo = '6' WHERE id = 382 AND villname <=> 'อุใดเหนือ,อุใดเจริญ' AND moo <=> NULL; -- อุใดเจริญ · กลาง
UPDATE satun_village_polygon SET villname = 'เกาะเปลว', moo = '3' WHERE id = 383 AND villname <=> 'หนองสร้อย , เกาะเปลว' AND moo <=> NULL; -- น้ำผุด · กลาง
UPDATE satun_village_polygon SET villname = 'ป้านโตน', moo = '5' WHERE id = 385 AND villname <=> 'โตน' AND moo <=> NULL; -- ทุ่งนุ้ย · กลาง
UPDATE satun_village_polygon SET villname = 'หนองราโพธิ์', moo = '6' WHERE id = 387 AND villname <=> 'หนองราโพธิ์, ปากคู' AND moo <=> NULL; -- น้ำผุด · กลาง
UPDATE satun_village_polygon SET villname = 'กาแบง, สุไหงมุโซะ', moo = '2' WHERE id = 390 AND villname <=> 'สุไหงมูโส๊ะ' AND moo <=> NULL; -- แหลมสน · กลาง
UPDATE satun_village_polygon SET villname = 'ควนบิหลายสา, ท่าน้ำเค็มใต้', moo = '10' WHERE id = 391 AND villname <=> 'คอนปิหลายสา' AND moo <=> NULL; -- ท่าแพ · กลาง
UPDATE satun_village_polygon SET villname = 'สะพานวา, ขุมทรัพย์', moo = '5' WHERE id = 393 AND villname <=> 'สะพานวา' AND moo <=> '5'; -- ป่าแก่บ่อหิน · สูง
UPDATE satun_village_polygon SET villname = 'ตันหยงโป, บากันเคย', moo = '1' WHERE id = 395 AND villname <=> 'ตันหยงโป' AND moo <=> '1'; -- ตันหยงโป · กลาง
UPDATE satun_village_polygon SET villname = 'ปาล์ม 4, ปาล์ม 3, ปากคอก', moo = '3' WHERE id = 396 AND villname <=> 'ปาล์ม 4' AND moo <=> '3'; -- ปาล์มพัฒนา · สูง
UPDATE satun_village_polygon SET villname = 'ลูโป๊ะฆอเลาะ', moo = '4' WHERE id = 399 AND villname <=> 'พอกอเราะ,ลูโป๊ะฆอเลาะ' AND moo <=> NULL; -- เกตรี · กลาง
UPDATE satun_village_polygon SET villname = 'หัวควน', moo = '8' WHERE id = 403 AND villname <=> 'ควนโดนใต้,หัวควน' AND moo <=> NULL; -- ควนสตอ · กลาง
UPDATE satun_village_polygon SET villname = 'ตันหยงอุมา', moo = '1' WHERE id = 407 AND villname <=> 'ตันหยงอุบา' AND moo <=> NULL; -- เกาะสาหร่าย · กลาง
UPDATE satun_village_polygon SET villname = 'เขานุ้ย, ทุ่งมะปรัง', moo = '2' WHERE id = 409 AND villname <=> 'เขานุ้ย' AND moo <=> '2'; -- วังประจัน · สูง
UPDATE satun_village_polygon SET villname = 'หัวสะพานเหล็ก, ควนโต๊ะเหลง', moo = '6' WHERE id = 411 AND villname <=> 'หัวสะพานเหล็ก' AND moo <=> '6'; -- ควนโดน · สูง
UPDATE satun_village_polygon SET villname = 'แป-ระใต้', moo = '4' WHERE id = 414 AND villname <=> 'แป- ระใต้, ป่าขนุน' AND moo <=> NULL; -- ท่าเรือ · กลาง
UPDATE satun_village_polygon SET villname = 'กาลันยินตัน บ้านลุ่มหว้า', moo = '5' WHERE id = 420 AND villname <=> 'กาลันยินตัน' AND moo <=> NULL; -- เจ๊ะบิลัง · กลาง
UPDATE satun_village_polygon SET villname = 'ราไวเหนือ, ราไวใต้', moo = '4' WHERE id = 423 AND villname <=> 'ราไวเหนือ' AND moo <=> '4'; -- ขอนคลาน · สูง
UPDATE satun_village_polygon SET villname = 'ชุมชนหลังโรงพัก', moo = NULL WHERE id = 430 AND villname <=> 'ไม่มีข้อมูล' AND moo <=> NULL; -- พิมาน · สูง
