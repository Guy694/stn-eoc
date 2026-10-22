-- สถานะความพร้อมปฏิบัติหน้าที่ของเจ้าหน้าที่ (รายงานเองจากเมนู "สถานะของฉัน" หรือแอดมินปรับให้)
-- 1 แถว = สถานะล่าสุดของเจ้าหน้าที่ 1 คน · ประวัติทุกครั้งที่เปลี่ยนอยู่ใน officer_readiness_log
CREATE TABLE IF NOT EXISTS officer_readiness (
    officer_id INT NOT NULL PRIMARY KEY,
    status VARCHAR(20) NOT NULL,
    note VARCHAR(255) NULL,
    source VARCHAR(10) NOT NULL DEFAULT 'self' COMMENT 'self = รายงานเอง, admin = ผู้ดูแลปรับให้',
    updated_by INT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_readiness_status (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS officer_readiness_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    officer_id INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    previous_status VARCHAR(20) NULL,
    note VARCHAR(255) NULL,
    source VARCHAR(10) NOT NULL DEFAULT 'self',
    updated_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_readiness_log_officer (officer_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
