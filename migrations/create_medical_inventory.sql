-- Medical inventory and logistics tables for EOC operations.
-- Source seed for initial flood session 3 data: satun_flood_inventory_long.csv

CREATE TABLE IF NOT EXISTS medical_inventory_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    external_event_id INT NULL,
    eoc_type VARCHAR(50) NOT NULL DEFAULT 'flood',
    session_number INT NULL,
    event_name VARCHAR(255) NOT NULL,
    source_file VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_inventory_event (eoc_type, session_number, event_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medical_inventory_stock (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inventory_event_id INT NOT NULL,
    inventory_agency_id INT NOT NULL,
    health_facility_id INT NULL,
    agency_name VARCHAR(255) NOT NULL,
    agency_name_original VARCHAR(255) NULL,
    agency_type VARCHAR(80) NULL,
    item_code VARCHAR(80) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    unit VARCHAR(80) NULL,
    movement_tracked BOOLEAN NOT NULL DEFAULT TRUE,
    opening_qty DECIMAL(14,2) NULL,
    received_qty DECIMAL(14,2) NULL,
    issued_qty DECIMAL(14,2) NULL,
    balance_qty DECIMAL(14,2) NULL,
    data_status ENUM('recorded', 'not_recorded') NOT NULL DEFAULT 'recorded',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_medical_inventory_stock_event
        FOREIGN KEY (inventory_event_id) REFERENCES medical_inventory_events(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_medical_inventory_stock_health_facility
        FOREIGN KEY (health_facility_id) REFERENCES health_facilities(id)
        ON DELETE SET NULL,
    UNIQUE KEY unique_inventory_stock_facility_item (inventory_event_id, health_facility_id, item_code),
    KEY idx_inventory_stock_inventory_agency (inventory_agency_id),
    KEY idx_inventory_stock_health_facility (health_facility_id),
    KEY idx_inventory_stock_item (item_code),
    KEY idx_inventory_stock_status (data_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medical_inventory_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stock_id INT NOT NULL,
    movement_type ENUM('receive', 'issue', 'adjust') NOT NULL,
    movement_qty DECIMAL(14,2) NOT NULL,
    balance_before DECIMAL(14,2) NULL,
    balance_after DECIMAL(14,2) NULL,
    requested_by VARCHAR(255) NULL,
    requested_team VARCHAR(255) NULL,
    eoc_session_id INT NULL,
    note TEXT NULL,
    movement_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_medical_inventory_movements_stock
        FOREIGN KEY (stock_id) REFERENCES medical_inventory_stock(id)
        ON DELETE CASCADE,
    KEY idx_inventory_movements_stock (stock_id),
    KEY idx_inventory_movements_type (movement_type),
    KEY idx_inventory_movements_session (eoc_session_id),
    KEY idx_inventory_movements_at (movement_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
