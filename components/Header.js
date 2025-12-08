export default function Header() {
    return (
        <header className="bg-green-800 text-white shadow-md">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                        <span className="text-green-800 font-bold text-xl">E</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">ระบบ EOC</h1>
                        <p className="text-xs text-green-100">Emergency Operations Center</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm">ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน</span>
                </div>
            </div>
        </header>
    );
}
