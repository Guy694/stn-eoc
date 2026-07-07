-- Migration: Create agency contacts table for the public agencies page
-- Stores public agency directory entries and emergency hotline contacts.

CREATE TABLE IF NOT EXISTS agency_contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(120) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role_description VARCHAR(500) NULL,
    area VARCHAR(255) NULL,
    phone VARCHAR(50) NULL,
    secondary_contact VARCHAR(255) NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'coordination',
    status VARCHAR(100) NULL,
    is_hotline TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_agency_contacts_active (is_active, is_hotline, sort_order),
    INDEX idx_agency_contacts_category (category),
    INDEX idx_agency_contacts_area (area)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO agency_contacts
    (slug, name, role_description, area, phone, secondary_contact, category, status, is_hotline, is_active, sort_order)
VALUES
    ('hotline-police', 'เหตุฉุกเฉินตำรวจ', 'รับแจ้งเหตุด่วนเหตุร้ายและประสานงานด้านความปลอดภัย', 'ทั่วประเทศ', '191', 'สายด่วนตำรวจ', 'safety', '24 ชั่วโมง', 1, 1, 10),
    ('hotline-fire', 'ดับเพลิง', 'รับแจ้งเหตุเพลิงไหม้และเหตุฉุกเฉินด้านอัคคีภัย', 'ทั่วประเทศ', '199', 'สายด่วนดับเพลิง', 'safety', '24 ชั่วโมง', 1, 1, 20),
    ('hotline-medical', 'หน่วยแพทย์ฉุกเฉิน', 'รับแจ้งเหตุเจ็บป่วยฉุกเฉินและประสานรถพยาบาล', 'ทั่วประเทศ', '1669', 'สายด่วนการแพทย์ฉุกเฉิน', 'medical', '24 ชั่วโมง', 1, 1, 30),
    ('hotline-ddpm', 'ปภ. สายด่วน', 'รับแจ้งภัยพิบัติและประสานการช่วยเหลือเร่งด่วน', 'ทั่วประเทศ', '1784', 'สายด่วนกรมป้องกันและบรรเทาสาธารณภัย', 'coordination', '24 ชั่วโมง', 1, 1, 40),
    ('hotline-damrongtham', 'ศูนย์ดำรงธรรม', 'รับเรื่องร้องทุกข์และประสานหน่วยงานภาครัฐ', 'ทั่วประเทศ', '1567', 'สายด่วนศูนย์ดำรงธรรม', 'coordination', '24 ชั่วโมง', 1, 1, 50),
    ('satun-health', 'สำนักงานสาธารณสุขจังหวัดสตูล', 'กำกับดูแลระบบสุขภาพและตอบโต้ภาวะฉุกเฉินด้านสุขภาพ', 'ทั้งจังหวัดสตูล', '074-711-123', 'โทรสาร 074-711-124', 'medical', 'ปฏิบัติการปกติ', 0, 1, 110),
    ('ddpm-satun', 'สำนักงานป้องกันและบรรเทาสาธารณภัยจังหวัดสตูล', 'ประสานงานเหตุฉุกเฉินและสนับสนุนการช่วยเหลือ', 'ทั้งจังหวัดสตูล', '074-711-201', 'สายด่วน 1784', 'coordination', 'ปฏิบัติการปกติ', 0, 1, 120),
    ('satun-hospital', 'โรงพยาบาลสตูล', 'ให้บริการรักษาพยาบาลระดับทุติยภูมิและรองรับส่งต่อ', 'อ.เมืองสตูล และพื้นที่ใกล้เคียง', '074-723-000', 'โทรสาร 074-723-001', 'medical', 'เปิดให้บริการ', 0, 1, 130),
    ('satun-police', 'ตำรวจภูธรจังหวัดสตูล', 'รักษาความปลอดภัย อำนวยความสะดวก และดูแลจราจร', 'ทั้งจังหวัดสตูล', '074-711-191', 'สายด่วน 191', 'safety', 'ปฏิบัติการปกติ', 0, 1, 140),
    ('local-admin', 'องค์กรปกครองส่วนท้องถิ่น', 'ช่วยเหลือประชาชนในพื้นที่และสนับสนุนกำลังเจ้าหน้าที่', 'ครอบคลุมพื้นที่ตำบล/เทศบาล', '074-XXXXXX', 'ประจำแต่ละพื้นที่', 'local', 'พร้อมประสานงาน', 0, 1, 150),
    ('districts', 'ที่ทำการอำเภอ / เทศบาล', 'บริหารจัดการพื้นที่และประสานงานเหตุฉุกเฉิน', '7 อำเภอ / 26 เทศบาล', '074-XXXXXX', 'ประจำแต่ละอำเภอ/เทศบาล', 'local', 'ปฏิบัติการปกติ', 0, 1, 160),
    ('electricity', 'การไฟฟ้าส่วนภูมิภาคจังหวัดสตูล', 'ดูแลเหตุไฟฟ้าขัดข้องและความปลอดภัยระบบไฟฟ้า', 'ทั้งจังหวัดสตูล', '1129', 'PEA Contact Center', 'utility', 'รับแจ้งเหตุ', 0, 1, 170)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    role_description = VALUES(role_description),
    area = VALUES(area),
    phone = VALUES(phone),
    secondary_contact = VALUES(secondary_contact),
    category = VALUES(category),
    status = VALUES(status),
    is_hotline = VALUES(is_hotline),
    is_active = VALUES(is_active),
    sort_order = VALUES(sort_order);
