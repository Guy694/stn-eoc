const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DEFAULT_PASSWORD = '1234';
const SOURCE_FILE = 'ค่ำสั่ง eoc สตูล.pdf';
const USERNAME_PREFIX = 'eoc2569';

const teamDefinitions = [
  { code: 'COMMANDER', th: 'ผู้บัญชาการเหตุการณ์และรองผู้บัญชาการเหตุการณ์', en: 'Incident Commander', color: 'red', icon: '🎖️', order: 1 },
  { code: 'SAT', th: 'กลุ่มภารกิจตระหนักรู้สถานการณ์', en: 'Situation Awareness Team', color: 'blue', icon: '📊', order: 2 },
  { code: 'PLANNING', th: 'กลุ่มภารกิจการวางแผน', en: 'Planning Team', color: 'indigo', icon: '🗂️', order: 3 },
  { code: 'SCIENTIFIC', th: 'กลุ่มภารกิจวิชาการ', en: 'Scientific Response Team', color: 'purple', icon: '🔬', order: 4 },
  { code: 'JIT', th: 'กลุ่มภารกิจปฏิบัติการสอบสวนควบคุมโรค', en: 'Joint Investigation Team', color: 'orange', icon: '🧭', order: 5 },
  { code: 'ACTIVE_SURV', th: 'กลุ่มภารกิจการเฝ้าระวังเชิงรุก', en: 'Active Surveillance', color: 'cyan', icon: '🔎', order: 6 },
  { code: 'CASE_MGMT', th: 'กลุ่มภารกิจการจัดการและดูแลรักษาผู้ป่วย', en: 'Case Management', color: 'green', icon: '🏥', order: 7 },
  { code: 'LAB', th: 'กลุ่มภารกิจห้องปฏิบัติการด้านสาธารณสุข', en: 'Public Health Laboratory', color: 'violet', icon: '🧪', order: 8 },
  { code: 'RISKCOM', th: 'กลุ่มภารกิจสื่อสารความเสี่ยง', en: 'Risk Communication', color: 'amber', icon: '📣', order: 9 },
  { code: 'VACCINE', th: 'กลุ่มภารกิจบริหารจัดการและบริการวัคซีน', en: 'Vaccine Support Team', color: 'emerald', icon: '💉', order: 10 },
  { code: 'MCATT', th: 'กลุ่มภารกิจช่วยเหลือเยียวยาจิตใจผู้ประสบภาวะวิกฤต', en: 'Mental Health Crisis Assessment and Treatment Team', color: 'pink', icon: '🫶', order: 11 },
  { code: 'POE', th: 'กลุ่มภารกิจด่านควบคุมโรคระหว่างประเทศ', en: 'Point of Entry', color: 'sky', icon: '🛂', order: 12 },
  { code: 'QUARANTINE', th: 'กลุ่มภารกิจปฏิบัติการกักกันโรค', en: 'Quarantine', color: 'slate', icon: '🏨', order: 13 },
  { code: 'MERT', th: 'กลุ่มภารกิจปฏิบัติการฉุกเฉินทางการแพทย์', en: 'Medical Emergency Response Team', color: 'rose', icon: '🚑', order: 14 },
  { code: 'SeRHT', th: 'กลุ่มภารกิจปฏิบัติการด้านอนามัยสิ่งแวดล้อม', en: 'Special Environmental Health Response Team', color: 'teal', icon: '🌿', order: 15 },
  { code: 'LOGISTICS', th: 'กลุ่มภารกิจสำรองวัสดุ เวชภัณฑ์ และส่งกำลังบำรุง', en: 'Logistics and Stockpiling', color: 'lime', icon: '📦', order: 16 },
  { code: 'LEGAL', th: 'กลุ่มภารกิจกฎหมาย', en: 'Legal', color: 'zinc', icon: '⚖️', order: 17 },
  { code: 'FINANCE', th: 'กลุ่มภารกิจการเงินและงบประมาณ', en: 'Finance', color: 'yellow', icon: '💰', order: 18 },
  { code: 'STAFFING', th: 'กลุ่มภารกิจจัดสรรกำลังคนในภาวะฉุกเฉิน', en: 'Emergency Personnel Staffing', color: 'fuchsia', icon: '👥', order: 19 },
  { code: 'ADMIN', th: 'กลุ่มภารกิจด้านบริหารและธุรการ', en: 'Administration', color: 'gray', icon: '🗃️', order: 20 },
  { code: 'ITSUPPORT', th: 'กลุ่มภารกิจด้านเทคโนโลยีดิจิทัล', en: 'IT Support', color: 'blue', icon: '💻', order: 21 },
  { code: 'LIAISON', th: 'กลุ่มภารกิจประสานงานและเลขานุการ', en: 'Liaison', color: 'stone', icon: '🤝', order: 22 },
  { code: 'EOC_MGMT', th: 'กลุ่มภารกิจการจัดการศูนย์ปฏิบัติการภาวะฉุกเฉิน', en: 'EOC Management', color: 'red', icon: '🏛️', order: 23 },
];

const people = [
  ['COMMANDER', 'นายแพทย์', 'ธีรศักดิ์', 'เด่นดวง', 'นายแพทย์สาธารณสุขจังหวัดสตูล', 'ผู้บัญชาการเหตุการณ์', 'commander'],
  ['COMMANDER', 'นายแพทย์', 'สงกรานต์', 'จันทร์มุณี', 'ผู้อำนวยการโรงพยาบาลสตูล', 'รองผู้บัญชาการเหตุการณ์', 'commander'],
  ['COMMANDER', 'แพทย์หญิง', 'อมรรัตน์', 'พันธ์คีรี', 'รองนายแพทย์สาธารณสุขจังหวัดสตูล', 'รองผู้บัญชาการเหตุการณ์', 'commander'],
  ['COMMANDER', 'นาย', 'วรายุส', 'วรรณวิไล', 'รองนายแพทย์สาธารณสุขจังหวัดสตูล', 'รองผู้บัญชาการเหตุการณ์', 'commander'],

  ['SAT', 'นาย', 'สุทธิมาศ', 'บินสอาด', 'นักวิชาการสาธารณสุขชำนาญการพิเศษ', 'ประธานกรรมการ', 'SAT'],
  ['SAT', 'นาง', 'สุขาภรณ์', 'รักษ์ศรีทอง', 'เภสัชกรชำนาญการ', 'กรรมการ', 'SAT'],
  ['SAT', 'นางสาว', 'ณัฐสิมา', 'ประทีปอนันต์', 'นักวิชาการคอมพิวเตอร์ชำนาญการ', 'กรรมการ', 'SAT'],
  ['SAT', 'นาย', 'นาท', 'ครูอ้น', 'นักวิชาการสาธารณสุขปฏิบัติการ', 'กรรมการ', 'SAT'],
  ['SAT', 'นางสาว', 'นุสรีย์', 'ปะดุกา', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการและเลขานุการ', 'SAT'],
  ['SAT', 'นาย', 'สันติพงษ์', 'ทองหอม', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'SAT'],

  ['PLANNING', 'นาง', 'อรนุช', 'นรารักษ์', 'นักวิชาการสาธารณสุขเชี่ยวชาญ', 'ประธานกรรมการ', 'staff'],
  ['PLANNING', 'นางสาว', 'กันยารัตน์', 'ศิริชา', 'นักวิเคราะห์นโยบายและแผนชำนาญการ', 'กรรมการ', 'staff'],
  ['PLANNING', 'นาย', 'จักรพงศ์', 'แหล่ทองคำ', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['PLANNING', 'นางสาว', 'ปาลิตา', 'ศรีริภาพ', 'นักสาธารณสุขปฏิบัติการ', 'กรรมการ', 'staff'],
  ['PLANNING', 'นาย', 'มะรอฟี', 'เจ๊ะสื่อแม', 'นักสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['PLANNING', 'นางสาว', 'โนรี', 'อำมาตย์นิติกุล', 'นักสาธารณสุขชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['PLANNING', 'นางสาว', 'ดรุณี', 'หมาดมาสัน', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],
  ['PLANNING', 'นาย', 'ณัฐสิทธิ์', 'สองเมือง', 'นักสาธารณสุขชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['SCIENTIFIC', 'นายแพทย์', 'พิทวัส', 'จินดาอิสรชัยกุล', 'นายแพทย์ชำนาญการพิเศษ', 'ประธานกรรมการ', 'staff'],
  ['SCIENTIFIC', 'แพทย์หญิง', 'กชมน', 'ภู่เจริญ', 'นายแพทย์ชำนาญการพิเศษ', 'กรรมการ', 'staff'],
  ['SCIENTIFIC', 'แพทย์หญิง', 'กนกวรรณ', 'แซ่ลิว', 'นายแพทย์ชำนาญการพิเศษ', 'กรรมการ', 'staff'],
  ['SCIENTIFIC', 'แพทย์หญิง', 'จักรปราณี', 'ตั้งสินมั่นคง', 'นายแพทย์ชำนาญการ', 'กรรมการ', 'staff'],
  ['SCIENTIFIC', 'นางสาว', 'นูรญามี', 'หมาดโต๊ะโส๊ะ', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['SCIENTIFIC', 'นาง', 'วีรียา', 'มาลินี', 'นักสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['SCIENTIFIC', 'นาง', 'สุวรรณา', 'ยาแบโด', 'พยาบาลวิชาชีพชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['SCIENTIFIC', 'นาง', 'ลักขณา', 'ผิวเหลือง', 'พยาบาลวิชาชีพชำนาญการพิเศษ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['JIT', 'นายแพทย์', 'พันธุ์เชษฐ์', 'บุญช่วย', 'ผู้อำนวยการโรงพยาบาลท่าแพ', 'ประธานกรรมการ', 'staff'],
  ['JIT', 'นางสาว', 'ศิริมา', 'ยุทธการกำธร', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['JIT', 'นาง', 'อนุสรา', 'เจ๊ะสัน', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['ACTIVE_SURV', 'แพทย์หญิง', 'ดาริน', 'ธนปัญญาบูรณ์', 'นายแพทย์ชำนาญการพิเศษ โรงพยาบาลสตูล', 'กรรมการ', 'staff'],
  ['ACTIVE_SURV', 'นาย', 'เจนฤทธิ์', 'รอเกตุ', 'สาธารณสุขอำเภอละงู', 'กรรมการ', 'staff'],
  ['ACTIVE_SURV', 'นาง', 'รุจกัลยา', 'ขาวเชาะ', 'นักสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['ACTIVE_SURV', 'นาย', 'ธงชัย', 'ทำเผือก', 'นักสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['ACTIVE_SURV', 'นาย', 'พงษ์ศักดิ์', 'นิยมรัฐ', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['ACTIVE_SURV', 'นาย', 'ธานัท', 'ยอดแก้ว', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['ACTIVE_SURV', 'นาย', 'เฟาซี', 'ดำยูโช๊ะ', 'นักสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['ACTIVE_SURV', 'นาย', 'ประกาศิต', 'เพชรกาฬ', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['ACTIVE_SURV', 'นางสาว', 'ฐานิศา', 'สาเบด', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['ACTIVE_SURV', 'นาย', 'ปรัชญา', 'เสียมไหม', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['ACTIVE_SURV', 'นาย', 'ยูนุส', 'มานะกล้า', 'นักวิชาการสาธารณสุขชำนาญการ โรงพยาบาลสตูล', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],
  ['ACTIVE_SURV', 'นางสาว', 'พิรินันทญาณ์', 'จันทร์ทิพย์', 'นักวิชาการสาธารณสุข', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['CASE_MGMT', 'แพทย์หญิง', 'สุดารัตน์', 'นาคบรรพต', 'รองผู้อำนวยการโรงพยาบาลสตูล', 'ประธานกรรมการ', 'staff'],
  ['CASE_MGMT', 'นางสาว', 'ชนนรัก', 'ถาวรบุญ', 'พยาบาลวิชาชีพชำนาญการ', 'กรรมการ', 'staff'],
  ['CASE_MGMT', 'นาง', 'ธัญญาลักษณ์', 'ดลระหมาน', 'พยาบาลวิชาชีพชำนาญการ', 'กรรมการ', 'staff'],
  ['CASE_MGMT', 'นาง', 'ฉัตรพิไล', 'เจียระนัย', 'นักวิชาการสาธารณสุขชำนาญการพิเศษ', 'กรรมการและเลขานุการ', 'staff'],
  ['CASE_MGMT', 'นาง', 'จินตนา', 'เรื่องหิรัญ', 'พยาบาลวิชาชีพชำนาญการพิเศษ', 'กรรมการและเลขานุการร่วม', 'staff'],
  ['CASE_MGMT', 'นาง', 'เบญจวรรณ', 'ใจเย็น', 'พยาบาลวิชาชีพชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],
  ['CASE_MGMT', 'นาง', 'อรอุมา', 'พินธุ์สุวรรณ', 'พยาบาลวิชาชีพชำนาญการพิเศษ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['LAB', 'นาง', 'ปวีณา', 'เหมรา', 'นักวิเคราะห์นโยบายและแผนชำนาญการพิเศษ', 'ประธานกรรมการ', 'staff'],
  ['LAB', 'นางสาว', 'วารียา', 'สัญญา', 'นักเทคนิคการแพทย์ชำนาญการพิเศษ', 'กรรมการ', 'staff'],
  ['LAB', 'นาย', 'สุทธิชาติ', 'เมืองปาน', 'พยาบาลวิชาชีพชำนาญการ', 'กรรมการ', 'staff'],
  ['LAB', 'นางสาว', 'ต่วนบีรนี', 'ดาราหมานเศษ', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['LAB', 'นาง', 'ลักขณา', 'ละอองวิจิตร', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['LAB', 'นางสาว', 'ยาหรีย๊ะ', 'เหมรา', 'พยาบาลวิชาชีพชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['RISKCOM', 'นาง', 'อัญชรีย์', 'สายพัทลุง', 'นักวิชาการสาธารณสุขชำนาญการ', 'ประธานกรรมการ', 'staff'],
  ['RISKCOM', 'นางสาว', 'มริณา', 'แดงงาม', 'เจ้าพนักงานทันตสาธารณสุขชำนาญงาน', 'กรรมการ', 'staff'],
  ['RISKCOM', 'นาง', 'นิรมล', 'เผือกสม', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['RISKCOM', 'นางสาว', 'ขวัญตา', 'วงค์คลองเขื่อน', 'เจ้าพนักงานสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['RISKCOM', 'นาย', 'อรรมพร', 'ศรีปานรอด', 'นักวิชาการคอมพิวเตอร์ปฏิบัติการ', 'กรรมการ', 'staff'],
  ['RISKCOM', 'นาย', 'สุขสันต์', 'มรรคาเขต', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['RISKCOM', 'นางสาว', 'รุ่งรัตน์', 'ดุลยาภรณ์', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],
  ['RISKCOM', 'นาย', 'ราชันท์', 'ปักครึก', 'เจ้าพนักงานสาธารณสุขชำนาญงาน', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['VACCINE', 'นายแพทย์', 'อดิศักดิ์', 'ชุมขวัญ', 'นายแพทย์ชำนาญการพิเศษ', 'ประธานกรรมการ', 'staff'],
  ['VACCINE', 'นางสาว', 'วริญญา', 'แซ่ตัน', 'เภสัชกรชำนาญการ', 'กรรมการ', 'staff'],
  ['VACCINE', 'นางสาว', 'เกตุอนิตย์สา', 'เส็นสมมาตร', 'เภสัชกรชำนาญการ', 'กรรมการ', 'staff'],
  ['VACCINE', 'นาง', 'มีเนาะ', 'แหล่ทองคำ', 'พยาบาลวิชาชีพชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['VACCINE', 'นางสาว', 'ชาลิสา', 'หมัดโส๊ะ', 'เภสัชกรชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['MCATT', 'แพทย์หญิง', 'สวรรยา', 'เสาวภาพ', 'นายแพทย์ชำนาญการ', 'ประธานกรรมการ', 'MCATT'],
  ['MCATT', 'นาง', 'คงขวัญ', 'วิทยาศิริกุล', 'พยาบาลวิชาชีพชำนาญการ', 'กรรมการ', 'MCATT'],
  ['MCATT', 'นาง', 'สุชาดา', 'ปิติเศรษฐพันธุ์', 'พยาบาลวิชาชีพชำนาญการ', 'กรรมการ', 'MCATT'],
  ['MCATT', 'นางสาว', 'เสาวภา', 'หมาดแน้ง', 'นักวิชาการสาธารณสุขปฏิบัติการ', 'กรรมการและเลขานุการ', 'MCATT'],

  ['POE', 'แพทย์หญิง', 'วนพัชร์', 'ยิ้มซ้าย', 'หัวหน้ากลุ่มภารกิจด้านบริการปฐมภูมิ โรงพยาบาลสตูล', 'ประธานกรรมการ', 'staff'],
  ['POE', 'นายแพทย์', 'ภูริวัจน์', 'ชูสิงห์แค', 'นายแพทย์ชำนาญการพิเศษ', 'กรรมการ', 'staff'],
  ['POE', 'นาย', 'ภูวนาถ', 'ภัทราภินันท์', 'สาธารณสุขอำเภอเมืองสตูล', 'กรรมการ', 'staff'],
  ['POE', 'นาย', 'พิทักษ์', 'หวังชัย', 'สาธารณสุขอำเภอควนโดน', 'กรรมการ', 'staff'],
  ['POE', 'นาย', 'ภิเษก', 'ณ นคร', 'นักสาธารณสุขชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['POE', 'นาย', 'อับดลมาหยืด', 'กาเส็มสัน', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['QUARANTINE', 'นาย', 'ศุภเดช', 'สุกใส', 'ทันตแพทย์ชำนาญการ', 'ประธานกรรมการ', 'staff'],
  ['QUARANTINE', 'นางสาว', 'วราภรณ์', 'เส้นสมมาตร', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['QUARANTINE', 'นาย', 'ธีรศักดิ์', 'มะแอเคียน', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['QUARANTINE', 'นางสาว', 'มญชุดา', 'พิธกิจ', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['QUARANTINE', 'นางสาว', 'พัทธ์ธิดา', 'ช่างนุ้ย', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['QUARANTINE', 'นางสาว', 'ปาริตา', 'ลารีนู', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['QUARANTINE', 'นาย', 'คเณศ', 'หนูน้อย', 'นักสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['QUARANTINE', 'นาย', 'ทวีศักดิ์', 'รักฤทธิ์', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['QUARANTINE', 'นาย', 'ฟารุค', 'สาดีน', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['QUARANTINE', 'นางสาว', 'รัตนาวดี', 'ณ ถลาง', 'พยาบาลวิชาชีพชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['QUARANTINE', 'นางสาว', 'เจนจิรา', 'นาดำ', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['MERT', 'นายแพทย์', 'จักรพงศ์', 'จันทนา', 'นายแพทย์ชำนาญการพิเศษ โรงพยาบาลสตูล', 'ประธานกรรมการ', 'staff'],
  ['MERT', 'แพทย์หญิง', 'รัญชนา', 'สิริวรรณาภรณ์', 'นายแพทย์ชำนาญการ โรงพยาบาลสตูล', 'รองประธานกรรมการ', 'staff'],
  ['MERT', 'นางสาว', 'ธันธิวาท์', 'คงเพ็ชร', 'พยาบาลวิชาชีพชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['MERT', 'นาง', 'สไบทิพย์', 'วิเศษสิงห์', 'พยาบาลวิชาชีพชำนาญการพิเศษ', 'กรรมการและเลขานุการร่วม', 'staff'],
  ['MERT', 'นางสาว', 'พาขวัญ', 'บุญเตี่ยว', 'นักจัดการงานทั่วไป', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['SeRHT', 'นาย', 'สุประพล', 'บินต่ำมะหงง', 'นักวิชาการสาธารณสุขชำนาญการพิเศษ', 'ประธานกรรมการ', 'SeRHT'],
  ['SeRHT', 'นาง', 'สุภัทร', 'กาญจนกำเนิด', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'SeRHT'],
  ['SeRHT', 'นาง', 'ลัดดาวรรณ', 'ยาแบโด', 'นักสาธารณสุขชำนาญการ', 'กรรมการ', 'SeRHT'],
  ['SeRHT', 'นางสาว', 'ลิลลี่', 'สุวามีน', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการและเลขานุการ', 'SeRHT'],

  ['LOGISTICS', 'นาย', 'ภาษิต', 'พิศาลสุทธิกุล', 'เภสัชกรเชี่ยวชาญ', 'ประธานกรรมการ', 'staff'],
  ['LOGISTICS', 'นาย', 'อำไพ', 'สัจจาพันธ์', 'เภสัชกรชำนาญการพิเศษ', 'กรรมการ', 'staff'],
  ['LOGISTICS', 'นางสาว', 'จันนง', 'โต๊ะหลัง', 'แพทย์แผนไทยชำนาญการพิเศษ', 'กรรมการ', 'staff'],
  ['LOGISTICS', 'นางสาว', 'อารีวรรณ์', 'ไชยรักษ์', 'เภสัชกรชำนาญการ', 'กรรมการ', 'staff'],
  ['LOGISTICS', 'นาย', 'สุเมธิ', 'พงศ์ดารา', 'เภสัชกรชำนาญการ', 'กรรมการ', 'staff'],
  ['LOGISTICS', 'นาง', 'อุษา', 'หมาดทิ้ง', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['LOGISTICS', 'นาย', 'มณู', 'สวนแก้ว', 'นักจัดการงานทั่วไปชำนาญการ', 'กรรมการ', 'staff'],
  ['LOGISTICS', 'นาง', 'สุขมาลย์', 'พัฒนศิริ', 'เภสัชกรชำนาญการพิเศษ', 'กรรมการและเลขานุการ', 'staff'],
  ['LOGISTICS', 'นาง', 'วรรณี', 'ภู่เจริญ', 'เภสัชกรเชี่ยวชาญ', 'กรรมการและเลขานุการร่วม', 'staff'],
  ['LOGISTICS', 'นาย', 'นิธิศ', 'สุธากุล', 'เภสัชกรชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],
  ['LOGISTICS', 'นาง', 'วรรยา', 'เมืองปาน', 'นักจัดการงานทั่วไปชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['LEGAL', 'นาย', 'ยุทธพงษ์', 'ตันทเสนีย์', 'นิติกรชำนาญการพิเศษ', 'ประธานกรรมการ', 'staff'],
  ['LEGAL', 'นางสาว', 'อินทิรา', 'คณะแนม', 'นิติกรชำนาญการ', 'กรรมการ', 'staff'],
  ['LEGAL', 'นางสาว', 'ณัชวา', 'โต๊ะประดู่', 'นิติกรปฏิบัติการ', 'กรรมการ', 'staff'],
  ['LEGAL', 'นาย', 'อิบรอเหม', 'ขาวเชาะ', 'นิติกรชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],

  ['FINANCE', 'นางสาว', 'อัญคนาย์', 'พูลสวัสดิ์', 'นักจัดการงานทั่วไปชำนาญการพิเศษ', 'ประธานกรรมการ', 'staff'],
  ['FINANCE', 'นาย', 'ประพันธ์', 'ด้วยกาเด', 'นักวิชาการสาธารณสุขชำนาญการพิเศษ', 'รองประธานกรรมการ', 'staff'],
  ['FINANCE', 'นาง', 'กัลยาพร', 'เพชรรักษ์', 'นักวิชาการเงินและบัญชีชำนาญการ', 'กรรมการ', 'staff'],
  ['FINANCE', 'นาง', 'เจ๊ะใหมซาเราะห์', 'จ๊ะสมัน', 'เจ้าพนักงานการเงินและบัญชีอาวุโส', 'กรรมการ', 'staff'],
  ['FINANCE', 'นาง', 'กมลรัตน์', 'ขาวแก้ว', 'นักจัดการงานทั่วไป', 'กรรมการ', 'staff'],
  ['FINANCE', 'นางสาว', 'นันท์นภัสร์', 'ขาวดี', 'นักวิชาการเงินและบัญชีชำนาญการ', 'กรรมการ', 'staff'],
  ['FINANCE', 'นางสาว', 'ยุวธิดา', 'ยูหันนั้น', 'นักวิชาการเงินและบัญชีชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['FINANCE', 'นางสาว', 'นิสรีน', 'สาเร๊ะ', 'นักสาธารณสุขชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['STAFFING', 'นาย', 'อัครเดช', 'ยาแบโด', 'นักทรัพยากรบุคคลชำนาญการพิเศษ', 'ประธานกรรมการ', 'staff'],
  ['STAFFING', 'นางสาว', 'นิลุบล', 'หวันสตูล', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['STAFFING', 'นาย', 'อาณัติ', 'เหมปันดัน', 'นักสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['STAFFING', 'นาย', 'มนตรี', 'หลังปูเต๊ะ', 'นักสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['STAFFING', 'นาย', 'อภิสิทธิ์', 'เส้งตี้', 'เจ้าพนักงานธุรการปฏิบัติงาน', 'กรรมการ', 'staff'],
  ['STAFFING', 'นางสาว', 'จุฑามาศ', 'ลำโป', 'นักจัดการงานทั่วไป', 'กรรมการ', 'staff'],
  ['STAFFING', 'นางสาว', 'ซารีตา', 'กรมเมือง', 'นักทรัพยากรบุคคล', 'กรรมการ', 'staff'],
  ['STAFFING', 'นาย', 'บุรุษรัตน', 'คมประมูล', 'นักทรัพยากรบุคคล', 'กรรมการ', 'staff'],
  ['STAFFING', 'นาง', 'นุศรา', 'ไหมมะหาด', 'นักทรัพยากรบุคคลชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['STAFFING', 'นาง', 'ปิยวรรณ', 'ทองจิบ', 'นักทรัพยากรบุคคลชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['ADMIN', 'นาย', 'เสรี', 'พงศ์นฤเดช', 'นักวิชาการสาธารณสุขชำนาญการพิเศษ', 'ประธานกรรมการ', 'staff'],
  ['ADMIN', 'นาง', 'เกษร', 'ถนอมศรีมงคล', 'นักจัดการงานทั่วไปชำนาญการพิเศษ', 'กรรมการ', 'staff'],
  ['ADMIN', 'นาง', 'เพ็ญนภา', 'เขาผึ้ง', 'นักทรัพยากรบุคคล', 'กรรมการ', 'staff'],
  ['ADMIN', 'นางสาว', 'ปรียาภรณ์', 'สุวรรณจุณี', 'เจ้าพนักงานธุรการ', 'กรรมการ', 'staff'],
  ['ADMIN', 'นาย', 'สาชล', 'กาญจนกำเนิด', 'นักวิชาการพัสดุชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['ADMIN', 'นางสาว', 'ดีวนา', 'หาสกุล', 'นักวิชาการพัสดุ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['ITSUPPORT', 'นาย', 'เกษม', 'ไปรฮูยัน', 'นักวิชาการสาธารณสุขชำนาญการ', 'ประธานกรรมการ', 'staff'],
  ['ITSUPPORT', 'นาย', 'ชาคริต', 'ทองนวล', 'นักวิชาการคอมพิวเตอร์ปฏิบัติการ', 'กรรมการ', 'staff'],
  ['ITSUPPORT', 'นาย', 'อำนาจ', 'พันธภาค', 'เจ้าพนักงานโสต', 'กรรมการ', 'staff'],
  ['ITSUPPORT', 'นาย', 'ประณต', 'มหาวิจิตร', 'นักวิชาการคอมพิวเตอร์ชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['ITSUPPORT', 'นาย', 'อิสมาแอล', 'เตบสัน', 'นักวิชาการคอมพิวเตอร์ชำนาญการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],

  ['LIAISON', 'นาย', 'ประดิษฐ์', 'รัตนพันธ์', 'นักวิเคราะห์นโยบายและแผนชำนาญการพิเศษ', 'ประธานกรรมการ', 'staff'],
  ['LIAISON', 'นาง', 'ศิริเพ็ญ', 'เจ๊ะสื่อแม', 'นักสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['LIAISON', 'นาง', 'ชญาดา', 'ยูโช๊ะยูด๊ะ', 'เจ้าพนักงานสาธารณสุขชำนาญงาน', 'กรรมการ', 'staff'],
  ['LIAISON', 'นางสาว', 'วิไลพร', 'ทองช่วย', 'นักวิชาการเงินและบัญชี', 'กรรมการ', 'staff'],
  ['LIAISON', 'นาย', 'อับดุลเลาะห์', 'นารอยี่', 'นักวิชาการสาธารณสุขปฏิบัติการ', 'กรรมการและเลขานุการ', 'staff'],
  ['LIAISON', 'นาง', 'อัตริยา', 'เตาวะโต', 'นักวิชาการสาธารณสุขปฏิบัติการ', 'กรรมการผู้ช่วยเลขานุการ', 'staff'],

  ['EOC_MGMT', 'นางสาว', 'อรอุษา', 'สุวรรณมณี', 'เภสัชกรชำนาญการ', 'กรรมการ', 'staff'],
  ['EOC_MGMT', 'นาย', 'เลิศวิทย์', 'รัตนะ', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการ', 'staff'],
  ['EOC_MGMT', 'นาย', 'พีรพล', 'สอนอำไพ', 'นักวิเคราะห์นโยบายและแผนชำนาญการ', 'กรรมการ', 'staff'],
  ['EOC_MGMT', 'นาย', 'สุขุม', 'รักษ์ศรีทอง', 'เจ้าพนักงานสาธารณสุขชำนาญงาน', 'กรรมการ', 'staff'],
  ['EOC_MGMT', 'นาง', 'สุนิสา', 'แกสมาน', 'นักวิชาการสาธารณสุขชำนาญการ', 'กรรมการและเลขานุการ', 'staff'],
  ['EOC_MGMT', 'นางสาว', 'กัญญารัตน์', 'มุเก็ม', 'นักวิชาการสาธารณสุขปฏิบัติการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],
  ['EOC_MGMT', 'นางสาว', 'อัลฝีฉ๊ะ', 'แกสมาน', 'แพทย์แผนไทยปฏิบัติการ', 'กรรมการและผู้ช่วยเลขานุการ', 'staff'],
];

const groupEntries = [
  'ผู้รับผิดชอบงานระบาดวิทยาระดับอำเภอทุกอำเภอ',
  'หัวหน้ากลุ่มงานพัฒนายุทธศาสตร์สาธารณสุขโรงพยาบาลทุกแห่ง หรือผู้แทน',
  'ผู้อำนวยการโรงพยาบาลชุมชนทุกแห่ง หรือผู้แทน',
  'สาธารณสุขอำเภอทุกแห่ง',
  'หน่วยปฏิบัติการควบคุมโรคติดต่อ (CDCU) ทุกอำเภอ',
  'หน่วยปฏิบัติการควบคุมโรคจากการประกอบอาชีพและโรคจากสิ่งแวดล้อม (Env Occ CU) ทุกอำเภอ',
  'ทีมเฝ้าระวังสอบสวนควบคุมโรคและภัยสุขภาพ (SRRT) ทุกอำเภอ',
  'ผู้รับผิดชอบงานระบาดวิทยา สำนักงานสาธารณสุขอำเภอ ทุกอำเภอ',
  'ประธานองค์กรแพทย์โรงพยาบาลทุกแห่ง',
  'หัวหน้ากลุ่มการพยาบาลโรงพยาบาลทุกแห่ง',
  'ผู้รับผิดชอบงานโรคติดเชื้อโรงพยาบาลทุกแห่ง',
  'หัวหน้ากลุ่มงานเทคนิคการแพทย์และพยาธิวิทยาคลินิกโรงพยาบาลทุกแห่ง',
  'เภสัชกรผู้รับผิดชอบงานคลังวัคซีน โรงพยาบาลทุกแห่ง',
  'ผู้รับผิดชอบงานสร้างเสริมภูมิคุ้มกันโรค โรงพยาบาลทุกแห่ง',
  'ผู้รับผิดชอบงานสร้างเสริมภูมิคุ้มกันโรค สสอ.ทุกแห่ง',
  'หัวหน้ากลุ่มงานจิตเวชและยาเสพติดทุกโรงพยาบาล',
  'ทีมช่วยเหลือเยียวยาจิตใจผู้ประสบภาวะวิกฤต (MCATT) ทุกอำเภอ',
  'เจ้าพนักงานควบคุมโรคติดต่อประจำด่านควบคุมโรคติดต่อระหว่างประเทศ ด่านท่าเรือตำมะลัง',
  'เจ้าพนักงานควบคุมโรคติดต่อประจำด่านควบคุมโรคติดต่อระหว่างประเทศ ด่านพรมแดนวังประจัน',
  'ผู้อำนวยการโรงพยาบาลส่งเสริมสุขภาพตำบลตำมะลัง',
  'ผู้อำนวยการโรงพยาบาลส่งเสริมสุขภาพตำบลวังประจัน',
  'หัวหน้างานอุบัติเหตุและฉุกเฉินทุกโรงพยาบาล',
  'ทีมปฏิบัติการฉุกเฉินทางการแพทย์ (MERT) ทุกอำเภอ',
  'ผู้รับผิดชอบงานอนามัยสิ่งแวดล้อมทุกสำนักงานสาธารณสุขอำเภอและโรงพยาบาล',
  'ทีมปฏิบัติการตอบโต้ภาวะฉุกเฉินด้านอนามัยสิ่งแวดล้อม (SEhRT) ทุกอำเภอ',
  'หัวหน้ากลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภคโรงพยาบาลชุมชนทุกแห่ง',
  'พนักงานขับรถสำนักงานสาธารณสุขจังหวัดสตูล ทุกคน',
  'ผู้รับผิดชอบงานเทคโนโลยีสารสนเทศ (ICT) โรงพยาบาลทุกแห่ง',
];

const preserveRoles = new Set(['admin']);

function normalizeName(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function rowToPerson(row) {
  const [teamCode, title, givenName, familyName, position, committeeRole, systemRole] = row;
  return {
    teamCode,
    title,
    givenName,
    familyName,
    position,
    committeeRole,
    systemRole,
    department: 'คณะกรรมการ EOC สำนักงานสาธารณสุขจังหวัดสตูล',
    sourceFile: SOURCE_FILE,
  };
}

async function nextUsername(connection) {
  const [rows] = await connection.execute(
    "SELECT username FROM officer WHERE username LIKE ? ORDER BY username DESC LIMIT 1",
    [`${USERNAME_PREFIX}_%`]
  );
  if (rows.length === 0) return `${USERNAME_PREFIX}_001`;
  const match = rows[0].username.match(/_(\d+)$/);
  const next = match ? Number(match[1]) + 1 : 1;
  return `${USERNAME_PREFIX}_${String(next).padStart(3, '0')}`;
}

async function upsertTeam(connection, team) {
  const [existing] = await connection.execute('SELECT id FROM eoc_teams WHERE team_code = ?', [team.code]);
  if (existing.length > 0) {
    await connection.execute(
      `UPDATE eoc_teams
       SET team_name_th = ?, team_name_en = ?, description = ?, icon = ?, color = ?, is_active = 1, sort_order = ?
       WHERE team_code = ?`,
      [team.th, team.en, `นำเข้าจาก ${SOURCE_FILE}`, team.icon, team.color, team.order, team.code]
    );
    return { action: 'updated', id: existing[0].id };
  }

  const [result] = await connection.execute(
    `INSERT INTO eoc_teams (team_code, team_name_th, team_name_en, description, icon, color, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    [team.code, team.th, team.en, `นำเข้าจาก ${SOURCE_FILE}`, team.icon, team.color, team.order]
  );
  return { action: 'created', id: result.insertId };
}

async function upsertPerson(connection, person, passwordHash) {
  const [existing] = await connection.execute(
    `SELECT id, username, role, password_hash
     FROM officer
     WHERE REPLACE(COALESCE(given_name, ''), ' ', '') = ?
       AND REPLACE(COALESCE(family_name, ''), ' ', '') = ?
     LIMIT 1`,
    [normalizeName(person.givenName), normalizeName(person.familyName)]
  );

  const notes = `EOC ${person.teamCode} - ${person.committeeRole}`;

  if (existing.length > 0) {
    const officer = existing[0];
    const nextRole = preserveRoles.has(officer.role) ? officer.role : person.systemRole;
    const nextPasswordHash = officer.password_hash || passwordHash;

    await connection.execute(
      `UPDATE officer
       SET title = COALESCE(NULLIF(title, ''), ?),
           given_name = ?,
           family_name = ?,
           password_hash = ?,
           role = ?,
           requested_role = CASE WHEN ? IN ('staff','MCATT','SAT','SeRHT','commander','admin') THEN ? ELSE requested_role END,
           position = ?,
           department = ?,
           is_approved = 1,
           approved_time = COALESCE(approved_time, NOW()),
           must_change_password = CASE WHEN ? THEN 1 ELSE must_change_password END,
           updated_at = NOW()
       WHERE id = ?`,
      [
        person.title,
        person.givenName,
        person.familyName,
        nextPasswordHash,
        nextRole,
        nextRole,
        nextRole,
        `${person.position} (${notes})`,
        person.department,
        officer.password_hash ? 0 : 1,
        officer.id,
      ]
    );
    return { action: 'updated', id: officer.id, username: officer.username };
  }

  const username = await nextUsername(connection);
  const [result] = await connection.execute(
    `INSERT INTO officer
     (username, title, given_name, family_name, password_hash, role, requested_role, position, department,
      is_approved, approved_time, must_change_password, password_changed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), 1, NOW())`,
    [
      username,
      person.title,
      person.givenName,
      person.familyName,
      passwordHash,
      person.systemRole,
      person.systemRole === 'user' ? 'staff' : person.systemRole,
      `${person.position} (${notes})`,
      person.department,
    ]
  );
  return { action: 'created', id: result.insertId, username };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'stneoc',
    port: Number(process.env.DB_PORT || 3306),
    charset: 'utf8mb4',
  });

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const report = {
    sourceFile: SOURCE_FILE,
    dryRun,
    defaultPassword: DEFAULT_PASSWORD,
    teams: [],
    officers: [],
    groupEntries,
  };

  try {
    await connection.beginTransaction();

    for (const team of teamDefinitions) {
      const result = await upsertTeam(connection, team);
      report.teams.push({ ...team, ...result });
    }

    const seen = new Set();
    for (const row of people) {
      const person = rowToPerson(row);
      const key = `${normalizeName(person.givenName)}|${normalizeName(person.familyName)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const result = await upsertPerson(connection, person, passwordHash);
      report.officers.push({ ...person, ...result });
    }

    if (dryRun) {
      await connection.rollback();
    } else {
      await connection.commit();
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }

  const reportPath = path.join(process.cwd(), 'tmp_eoc_satun_import_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  const createdOfficers = report.officers.filter((item) => item.action === 'created').length;
  const updatedOfficers = report.officers.filter((item) => item.action === 'updated').length;
  const createdTeams = report.teams.filter((item) => item.action === 'created').length;
  const updatedTeams = report.teams.filter((item) => item.action === 'updated').length;

  console.log(JSON.stringify({
    dryRun,
    sourceFile: SOURCE_FILE,
    teams: { created: createdTeams, updated: updatedTeams, total: report.teams.length },
    officers: { created: createdOfficers, updated: updatedOfficers, total: report.officers.length },
    groupEntriesSkipped: groupEntries.length,
    reportPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
