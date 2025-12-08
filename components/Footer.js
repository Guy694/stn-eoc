export default function Footer() {
    return (
        <footer className="bg-gray-800 text-gray-300 border-t border-gray-700">
            <div className="container mx-auto px-4 py-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <h4 className="font-bold text-white mb-2">ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน</h4>
                        <p className="text-sm">Emergency Operations Center (EOC)</p>
                        <p className="text-sm mt-2">ระบบบริหารจัดการภัยพิบัติและเหตุฉุกเฉิน</p>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-2">ติดต่อเรา</h4>
                        <p className="text-sm">โทร: 1669 (ฉุกเฉิน)</p>
                        <p className="text-sm">อีเมล: eoc@disaster.go.th</p>
                        <p className="text-sm">เวลาทำการ: 24/7</p>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-2">ลิงก์ที่เกี่ยวข้อง</h4>
                        <ul className="text-sm space-y-1">
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
                <div className="border-t border-gray-700 mt-6 pt-4 text-center text-sm">
                    <p>&copy; 2025 ระบบ EOC - All Rights Reserved</p>
                </div>
            </div>
        </footer>
    );
}
