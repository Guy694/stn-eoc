// Mock data for testing

export const mockUser = {
    id: 1,
    username: 'testuser',
    title: 'นาย',
    givenName: 'ทดสอบ',
    familyName: 'ระบบ',
    email: 'test@example.com',
    phone: '0812345678',
    role: 'admin',
    department: 'IT',
    position: 'System Admin',
    roleDisplay: 'ผู้ดูแลระบบ',
    permissions: {
        dashboard: true,
        eoc: {
            view: true,
            create: true,
            edit: true,
            delete: true
        },
        admin: {
            view: true
        },
        reports: {
            view: true,
            export: true
        }
    }
};

export const mockOfficer = {
    id: 2,
    username: 'officer01',
    title: 'นาง',
    given_name: 'สมหญิง',
    family_name: 'ใจดี',
    email: 'officer@example.com',
    phone: '0823456789',
    role: 'mcatt',
    department: 'MCATT',
    position: 'Officer'
};

export const mockIncidentReport = {
    id: 1,
    disaster_type: 'flood',
    report_type: 'help_request',
    first_name: 'สมชาย',
    last_name: 'ดีมาก',
    phone: '0834567890',
    latitude: '6.6238',
    longitude: '100.0673',
    village: 'หมู่บ้านทดสอบ',
    sub_district: 'ตำบลทดสอบ',
    district: 'อำเภอเมือง',
    description: 'น้ำท่วมสูง ต้องการความช่วยเหลือ',
    water_level: 50,
    affected_people: 10,
    urgency: 'high',
    status: 'pending',
    photo_path: null,
    created_at: new Date('2026-01-01'),
    occurred_at: new Date('2026-01-01')
};

export const mockAnnouncement = {
    id: 1,
    title: 'ประกาศทดสอบ',
    eoc_type: 'flood',
    description: 'นี่คือประกาศทดสอบ',
    image_path: '/uploads/test.jpg',
    show_popup: true,
    priority: 1,
    is_active: true,
    created_by: 1,
    start_date: new Date('2026-01-01'),
    end_date: new Date('2026-12-31'),
    created_at: new Date('2026-01-01')
};

export const mockSession = {
    sessionToken: 'test_session_token_123',
    user: mockUser,
    success: true
};
