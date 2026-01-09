"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import EOCTeamManager from "@/components/EOCTeamManager";

export default function EOCSessionTeamsPage() {
    const router = useRouter();
    const params = useParams();
    const { user, loading: authLoading } = useAuth();
    const sessionId = params.sessionId;

    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'admin')) {
            router.push("/dashboard");
        }
    }, [user, authLoading, router]);

    if (authLoading || !user) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <EOCLayout>
            <div className="container mx-auto p-6">
                <EOCTeamManager
                    sessionId={sessionId}
                    onTeamUpdated={() => {
                        console.log('Teams updated successfully');
                    }}
                />
            </div>
        </EOCLayout>
    );
}
