export default function Header() {
    return (
        <header className="bg-green-800 text-white shadow-md">
            <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    {/* Logo and Title */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 md:w-16 md:h-16 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                            <img src="/img/logo.png" alt="EOC Logo" className="w-10 h-10 md:w-16 md:h-16" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold">EOC จังหวัดสตูล</h1>
                            <p className="text-xs text-green-100 hidden sm:block">Emergency Operations Center</p>
                        </div>
                    </div>

                    {/* Province Name */}
                    <div className="hidden md:flex items-center">
                        <span className="text-xs sm:text-sm">ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน จังหวัดสตูล</span>
                    </div>

                    {/* Mobile - Abbreviated */}
                    <div className="md:hidden flex items-center">
                        <span className="text-xs">จ.สตูล</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
