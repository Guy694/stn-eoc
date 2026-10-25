import PublicHeader from "@/components/public/PublicHeader";
import PublicTopNavigation from "@/components/public/PublicTopNavigation";
import Footer from "@/components/Footer";
import AIChatbot from "@/components/AIChatbot";
import AlertSubscribePrompt from "@/components/public/alerts/AlertSubscribePrompt";
import PublicDataNotice from "@/components/public/PublicDataNotice";

export default function PublicLayout({ children }) {
    return (
        <div className="flex flex-col min-h-screen">
            <PublicHeader />
            <PublicTopNavigation />
            <PublicDataNotice />
            <main className="flex-1 bg-gray-50">
                {children}
            </main>
            <Footer />
            <AIChatbot />
            <AlertSubscribePrompt />
        </div>
    );
}
