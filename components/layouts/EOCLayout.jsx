"use client";
import Header from "@/components/Header";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";

import { useAuth } from "@/context/AuthContext";

export default function EOCLayout({ children }) {
    const { user } = useAuth();

    // Citizens don't get sidebar - they only have access to public features
    const showSidebar = user?.role !== 'citizen';

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <Navbar />
            <div className="flex flex-1 relative">
                {showSidebar && <Sidebar />}
                <main className="flex-1 bg-gray-50 overflow-auto w-full lg:w-auto">
                    {/* <Breadcrumb /> */}
                    <div className="p-4 sm:p-6">
                        {children}
                    </div>
                </main>
            </div>
            <Footer />
        </div>
    );
}
