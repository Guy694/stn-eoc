CREATE TABLE IF NOT EXISTS registration_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_type ENUM('citizen', 'officer') NOT NULL,
    officer_id INT NULL,
    pid_hash VARCHAR(64) NULL,
    title VARCHAR(50) NULL,
    given_name VARCHAR(100) NOT NULL,
    family_name VARCHAR(100) NOT NULL,
    normalized_given_name VARCHAR(120) NOT NULL,
    normalized_family_name VARCHAR(120) NOT NULL,
    agency VARCHAR(255) NOT NULL,
    username VARCHAR(50) NULL,
    email VARCHAR(100) NULL,
    phone VARCHAR(20) NULL,
    status ENUM('pending', 'verified', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    request_ip VARCHAR(45) NULL,
    user_agent TEXT NULL,
    verified_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_registration_requests_lookup (user_type, normalized_given_name, normalized_family_name, status),
    INDEX idx_registration_requests_ip (request_ip, created_at),
    INDEX idx_registration_requests_pid_hash (pid_hash),
    UNIQUE KEY unique_registration_username (username),
    CONSTRAINT fk_registration_requests_officer
        FOREIGN KEY (officer_id) REFERENCES officer(id)
        ON DELETE SET NULL
);
