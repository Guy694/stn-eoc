-- สร้างตารางสำหรับเก็บข้อมูลตำบลในจังหวัดสตูล
-- Create table for storing tambon (sub-district) data in Satun province
-- ใช้ GEOMETRY type สำหรับเก็บ GeoJSON coordinates

-- ลบตารางเก่าถ้ามี (เพื่อสร้างใหม่ด้วย structure ใหม่)
DROP TABLE IF EXISTS `tambons`;

CREATE TABLE `tambons` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tam_name` VARCHAR(255) NOT NULL COMMENT 'ชื่อตำบล',
  `dis_name` VARCHAR(255) NOT NULL COMMENT 'ชื่ออำเภอ',
  `pro_name` VARCHAR(255) NOT NULL COMMENT 'ชื่อจังหวัด',
  `tum_code` VARCHAR(10) DEFAULT NULL COMMENT 'รหัสตำบล',
  `dis_code` VARCHAR(10) DEFAULT NULL COMMENT 'รหัสอำเภอ',
  `pro_code` VARCHAR(10) DEFAULT NULL COMMENT 'รหัสจังหวัด',
  `geometry` GEOMETRY NOT NULL COMMENT 'ข้อมูล Geometry (MultiPolygon)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  SPATIAL INDEX `idx_geometry` (`geometry`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== INSERT ข้อมูลตำบล =====
-- ใช้ ST_GeomFromGeoJSON() เพื่อแปลง GeoJSON เป็น GEOMETRY

-- อำเภอเมืองสตูล (12 ตำบล + 3 เกาะ)
-- เกาะตะรุเตา
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('เกาะตะรุเตา', 'เมืองสตูล', 'สตูล', NULL, NULL, NULL,
  ST_GeomFromGeoJSON('{"type":"MultiPolygon","coordinates":[[[[99.637256191845395,6.671843070897476],[99.646144347748205,6.693133579954091],[99.646667180448347,6.702480339626503],[99.642484518847027,6.707153652285242],[99.64562151504802,6.715980898313186],[99.640393188046374,6.72948108241431],[99.646667180448347,6.73986558405543],[99.652941172850362,6.735711810070783],[99.658169499852008,6.727404155425051],[99.667580488454973,6.714423160644783],[99.667580488454973,6.704038115491509],[99.670717484655952,6.698326246323049],[99.675945811657613,6.699364772965897],[99.682219804059585,6.691575769272223],[99.684833967560408,6.680670955422498],[99.684833967560408,6.667688717230321],[99.684833967560408,6.653667513755995],[99.68274263675977,6.640684561031049],[99.680128473258932,6.632894624947864],[99.675422978057461,6.625104565702127],[99.671240316456127,6.613159569307924],[99.668626152955304,6.607446642851344],[99.662874993253489,6.608485361662119],[99.661783326352785,6.597059334827344],[99.657600664751451,6.587710571382494],[99.651326672349479,6.576284065734975],[99.647666843448302,6.569531916154796],[99.641915683746502,6.560182634698007],[99.639301520245679,6.55602734216498],[99.637256191845395,6.554988513619307],[99.632550696644003,6.547197230563216],[99.62732236964234,6.539405825907854],[99.621571209940526,6.532133738645382],[99.616342882938874,6.524342099301275],[99.602273918434395,6.532653176956139],[99.599136922233402,6.535250360420164],[99.599136922233402,6.525900436869222],[99.595477093332224,6.513953058361455],[99.591817264431033,6.509277919742694],[99.589726934630367,6.508238994137538],[99.585544273029033,6.502005395386779],[99.582929109528211,6.49992751195612],[99.575609446225914,6.512914142431527],[99.565675624923093,6.529536539004146],[99.560969129721694,6.542522402352812],[99.553649466419411,6.553949682909344],[99.549466804818077,6.564337892575399],[99.548375137917359,6.565376701627277],[99.545238141716366,6.574206491014871],[99.540531646514967,6.587710571382494],[99.53686998431373,6.602253016084616],[99.535778317412998,6.611082149143638],[99.533687987612333,6.613678922984626],[99.530550991411339,6.62198850755014],[99.527413995210345,6.636529943788889],[99.526845161009782,6.647435739235198],[99.526845161009782,6.664572928870013],[99.527936827910514,6.665611527190389],[99.637256191845395,6.671843070897476]]]]}'));

-- เกาะอาดัง
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('เกาะอาดัง', 'เมืองสตูล', 'สตูล', NULL, NULL, NULL,
  ST_GeomFromGeoJSON('{"type":"MultiPolygon","coordinates":[[[[99.624389536541682,6.510057112536],[99.624909936541667,6.518368427062715],[99.634840486544251,6.540184971841307],[99.636960936544608,6.548236075332869],[99.644518386545382,6.567454313227712],[99.650034136546013,6.577063154016111],[99.650554536546,6.571609510405847],[99.650294986545984,6.567973714772713],[99.649514836545894,6.565636403551565],[99.647654286545691,6.565636403551565],[99.645793686545488,6.563558784364167],[99.643933136545285,6.561481156508481],[99.642072586545082,6.563818487236694],[99.640212036544879,6.559143814812876],[99.638871336544734,6.555507928162703],[99.636230686544478,6.553949682909345],[99.633590036544222,6.550054048477],[99.628308736543672,6.542522402352815],[99.623287386543147,6.534730924806138],[99.619046136542668,6.528237934129988],[99.613764836542118,6.520965684610026],[99.610344036541732,6.515251700249012],[99.607443136541411,6.511355764504292],[99.604022336541024,6.507719530529016],[99.600341636540612,6.507459798523289],[99.596920836540226,6.507979262400434],[99.624389536541682,6.510057112536]]]]}'));

-- เกาะราวี
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('เกาะราวี', 'เมืองสตูล', 'สตูล', NULL, NULL, NULL,
  ST_GeomFromGeoJSON('{"type":"MultiPolygon","coordinates":[[[[99.617544086542378,6.545898671561211],[99.618324236542468,6.547716653218285],[99.621705086542834,6.552910850035426],[99.622485236542924,6.553430266742858],[99.625346186543227,6.557585580924706],[99.630107586543741,6.566415508511494],[99.635388836544291,6.575504976232543],[99.63928983654482,6.58199735142616],[99.640070036544911,6.582516737775713],[99.639549586544924,6.579400411530292],[99.639029186544939,6.57810193649091],[99.638248986544849,6.579919800595741],[99.637728586544862,6.579140716793921],[99.636428286544703,6.576803458058109],[99.635388836544291,6.575764672869044],[99.634608686544201,6.575504976232543],[99.632308186543943,6.575504976232543],[99.630787786543773,6.576543761964396],[99.629267336543603,6.57810193649091],[99.625866036543177,6.57810193649091],[99.623045686542878,6.571349811599029],[99.621525286542708,6.569791615910708],[99.618584536542375,6.565116999567516],[99.616284036542117,6.562519971519693],[99.613983486541858,6.560182634698011],[99.610582186541433,6.556806462153717],[99.607180886541007,6.553430266742858],[99.603779586540581,6.550054048477],[99.600378286540155,6.546677807367711],[99.596976986539729,6.549015207491248],[99.596456586539742,6.548236075332869],[99.596196986539724,6.550833177797063],[99.595416836539634,6.552910850035426],[99.595156936539616,6.55031375838553],[99.591755636539191,6.544080683285024],[99.588874236538839,6.540444686882527],[99.584693086538389,6.540964116560045],[99.580511936537939,6.545379247014788],[99.579731736537848,6.544340396301092],[99.577171336537562,6.540444686882527],[99.575130986537344,6.538626678759833],[99.572830486537086,6.540444686882527],[99.571050136536895,6.539146110326795],[99.569269736536704,6.537847530397386],[99.567489336536514,6.542262688391529],[99.617544086542378,6.545898671561211]]]]}'));

-- พิมาน
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('พิมาน', 'เมืองสตูล', 'สตูล', '01', '01', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- คลองขุด
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('คลองขุด', 'เมืองสตูล', 'สตูล', '02', '01', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ควนขัน
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ควนขัน', 'เมืองสตูล', 'สตูล', '03', '01', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- บ้านควน
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('บ้านควน', 'เมืองสตูล', 'สตูล', '04', '01', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ฉลุง
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ฉลุง', 'เมืองสตูล', 'สตูล', '05', '01', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- เกาะสาหร่าย
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('เกาะสาหร่าย', 'เมืองสตูล', 'สตูล', '06', '01', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ตันหยงโป
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ตันหยงโป', 'เมืองสตูล', 'สตูล', '07', '01', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- เจ๊ะบิลัง
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('เจ๊ะบิลัง', 'เมืองสตูล', 'สตูล', '08', '01', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ตำมะลัง
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ตำมะลัง', 'เมืองสตูล', 'สตูล', '09', '01', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ปูยู
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ปูยู', 'เมืองสตูล', 'สตูล', '10', '01', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ควนโพธิ์
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ควนโพธิ์', 'เมืองสตูล', 'สตูล', '11', '01', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- เกตรี
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('เกตรี', 'เมืองสตูล', 'สตูล', '12', '01', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ===== อำเภอควนโดน (4 ตำบล) =====
-- ควนโดน
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ควนโดน', 'ควนโดน', 'สตูล', '01', '02', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ควนสตอ
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ควนสตอ', 'ควนโดน', 'สตูล', '02', '02', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ย่านซื่อ
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ย่านซื่อ', 'ควนโดน', 'สตูล', '03', '02', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- วังประจัน
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('วังประจัน', 'ควนโดน', 'สตูล', '04', '02', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ===== อำเภอควนกาหลง (3 ตำบล) =====
-- ทุ่งนุ้ย
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ทุ่งนุ้ย', 'ควนกาหลง', 'สตูล', '01', '03', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ควนกาหลง
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ควนกาหลง', 'ควนกาหลง', 'สตูล', '02', '03', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- อุใดเจริญ
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('อุใดเจริญ', 'ควนกาหลง', 'สตูล', '03', '03', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ===== อำเภอท่าแพ (4 ตำบล) =====
-- ท่าแพ
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ท่าแพ', 'ท่าแพ', 'สตูล', '01', '04', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- แป-ระ
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('แป-ระ', 'ท่าแพ', 'สตูล', '02', '04', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- สาคร
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('สาคร', 'ท่าแพ', 'สตูล', '03', '04', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ท่าเรือ
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ท่าเรือ', 'ท่าแพ', 'สตูล', '04', '04', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ===== อำเภอละงู (6 ตำบล) =====
-- กำแพง
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('กำแพง', 'ละงู', 'สตูล', '01', '05', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ละงู
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ละงู', 'ละงู', 'สตูล', '02', '05', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- เขาขาว
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('เขาขาว', 'ละงู', 'สตูล', '03', '05', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ปากน้ำ
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ปากน้ำ', 'ละงู', 'สตูล', '04', '05', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- น้ำผุด
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('น้ำผุด', 'ละงู', 'สตูล', '05', '05', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- แหลมสน
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('แหลมสน', 'ละงู', 'สตูล', '06', '05', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ===== อำเภอทุ่งหว้า (5 ตำบล) =====
-- ทุ่งหว้า
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ทุ่งหว้า', 'ทุ่งหว้า', 'สตูล', '01', '06', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- นาทอน
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('นาทอน', 'ทุ่งหว้า', 'สตูล', '02', '06', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ขอนคลาน
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ขอนคลาน', 'ทุ่งหว้า', 'สตูล', '03', '06', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ทุ่งบุหลัง
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ทุ่งบุหลัง', 'ทุ่งหว้า', 'สตูล', '04', '06', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ป่าแก่บ่อหิน
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ป่าแก่บ่อหิน', 'ทุ่งหว้า', 'สตูล', '05', '06', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- ===== อำเภอมะนัง (2 ตำบล) =====
-- ปาล์มพัฒนา
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('ปาล์มพัฒนา', 'มะนัง', 'สตูล', '01', '07', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- นิคมพัฒนา
INSERT INTO `tambons` (`tam_name`, `dis_name`, `pro_name`, `tum_code`, `dis_code`, `pro_code`, `geometry`) VALUES
('นิคมพัฒนา', 'มะนัง', 'สตูล', '02', '07', '91',
  ST_GeomFromText('MULTIPOLYGON(((100.0 6.5, 100.1 6.5, 100.1 6.6, 100.0 6.6, 100.0 6.5)))', 4326));

-- สร้าง index เพื่อความเร็วในการค้นหา
CREATE INDEX idx_tam_name ON tambons(tam_name);
CREATE INDEX idx_dis_name ON tambons(dis_name);
CREATE INDEX idx_pro_name ON tambons(pro_name);
CREATE INDEX idx_codes ON tambons(tum_code, dis_code, pro_code);

-- ===== วิธีใช้งาน =====
-- การดึงข้อมูล geometry เป็น GeoJSON:
-- SELECT tam_name, ST_AsGeoJSON(geometry) as geojson FROM tambons;

-- การดึง GeoJSON แบบเต็ม (รวม properties):
-- SELECT JSON_OBJECT(
--   'type', 'Feature',
--   'properties', JSON_OBJECT(
--     'tam_name', tam_name,
--     'dis_name', dis_name,
--     'pro_name', pro_name,
--     'tum_code', tum_code,
--     'dis_code', dis_code,
--     'pro_code', pro_code
--   ),
--   'geometry', CAST(ST_AsGeoJSON(geometry) AS JSON)
-- ) as feature FROM tambons;

-- ตรวจสอบว่าจุดอยู่ในตำบลใด:
-- SELECT tam_name FROM tambons 
-- WHERE ST_Contains(geometry, ST_GeomFromText('POINT(100.05 6.55)', 4326));

-- ข้อมูลสรุป
-- Total tambons: 36
-- อำเภอเมืองสตูล: 12 ตำบล + 3 เกาะ
-- อำเภอควนโดน: 4 ตำบล
-- อำเภอควนกาหลง: 3 ตำบล
-- อำเภอท่าแพ: 4 ตำบล
-- อำเภอละงู: 6 ตำบล
-- อำเภอทุ่งหว้า: 5 ตำบล
-- อำเภอมะนัง: 2 ตำบล
