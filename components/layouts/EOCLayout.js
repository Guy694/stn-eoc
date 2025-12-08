import Header from "@/components/Header";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";

export default function EOCLayout({ children }) {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <Navbar />
            <div className="flex flex-1">
                <Sidebar />
                <main className="flex-1 p-6 bg-gray-50 overflow-auto">
                    {children}
                </main>
            </div>
            <Footer />
        </div>
    );
}
