import Header from "@/components/Header";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AIChatbot from "@/components/AIChatbot";

export default function PublicLayout({ children }) {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <Navbar />
            <main className="flex-1 bg-gray-50">
                {children}
            </main>
            <Footer />
            <AIChatbot />
        </div>
    );
}
