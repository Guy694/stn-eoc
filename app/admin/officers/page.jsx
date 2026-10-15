'use client';

import EOCLayout from '@/components/layouts/EOCLayout';
import OfficerWorkspace from '@/components/admin/officers/OfficerWorkspace';

export default function OfficersManagementPage() {
    return (
        <EOCLayout>
            <OfficerWorkspace />
        </EOCLayout>
    );
}
