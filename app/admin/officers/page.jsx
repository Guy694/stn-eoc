'use client';

import EOCLayout from '@/components/layouts/EOCLayout';
import OfficerWorkspace from '@/components/admin/officers/OfficerWorkspace';
import LinkTabs, { USER_ADMIN_TABS } from '@/components/common/LinkTabs';

export default function OfficersManagementPage() {
    return (
        <EOCLayout>
            <LinkTabs items={USER_ADMIN_TABS} current="officers" label="ผู้ใช้งาน" className="mb-4" />
            <OfficerWorkspace />
        </EOCLayout>
    );
}
