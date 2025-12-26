export default function Footer() {
    return (
        <footer className="bg-gray-800 text-gray-300 border-t border-gray-700">
            <div className="container mx-auto px-4 py-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                        <h4 className="font-bold text-white mb-2 text-sm sm:text-base">ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน จังหวัดสตูล</h4>
                        <p className="text-xs sm:text-sm">Satun Emergency Operations Center (EOC)</p>
                        <p className="text-xs sm:text-sm mt-2">ระบบบริหารจัดการภัยพิบัติและเหตุฉุกเฉิน จังหวัดสตูล</p>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-2 text-sm sm:text-base">ติดต่อเรา</h4>
                        <p className="text-xs sm:text-sm">โทร: ..........</p>
                        <p className="text-xs sm:text-sm">อีเมล: .............</p>

                    </div>
                    <div className="sm:col-span-2 lg:col-span-1">
                        <h4 className="font-bold text-white mb-2 text-sm sm:text-base">ลิงก์ที่เกี่ยวข้อง</h4>
                        <ul className="text-xs sm:text-sm space-y-1">
                            <li>
                                <a href="#" className="hover:text-white transition-colors">
                                    กรมป้องกันและบรรเทาสาธารณภัย
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-white transition-colors">
                                    กระทรวงมหาดไทย
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-white transition-colors">
                                    กรมอุตุนิยมวิทยา
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="border-t border-gray-700 mt-6 pt-4 text-center text-xs sm:text-sm">
                    <p>&copy; 2025 EOC จังหวัดสตูล - All Rights Reserved</p>
                </div>
            </div>
        </footer>
    );
}
