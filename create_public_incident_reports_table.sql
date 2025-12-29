-- Create table for public incident reports
CREATE TABLE IF NOT EXISTS public_incident_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Reporter Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    
    -- Location Information
    village VARCHAR(100),
    sub_district VARCHAR(100),
    district VARCHAR(100),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    
    -- Incident Details
    description TEXT NOT NULL,
    water_level VARCHAR(50) NOT NULL,
    affected_people INT,
    urgency ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    occurred_at DATETIME,
    
    -- Media
    photo_path VARCHAR(255),
    
    -- Status and Tracking
    status ENUM('pending', 'reviewing', 'verified', 'resolved', 'rejected') DEFAULT 'pending',
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    reviewed_by INT,
    admin_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_reported_at (reported_at),
    INDEX idx_location (latitude, longitude),
    INDEX idx_urgency (urgency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
