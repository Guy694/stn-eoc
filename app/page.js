import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-green-50 to-green-100">
      <main className="text-center px-6">
        <div className="mb-8">
          <div className="w-24 h-24 bg-green-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-5xl">E</span>
          </div>
          <h1 className="text-5xl font-bold text-gray-800 mb-2">
            ระบบ EOC
          </h1>
          <p className="text-xl text-gray-600 mb-1">Emergency Operations Center</p>
          <p className="text-gray-500">ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/login"
            className="bg-green-700 hover:bg-green-800 text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-lg transition-all hover:shadow-xl transform hover:-translate-y-1"
          >
            🔐 เข้าสู่ระบบ EOC
          </Link>
          <Link
            href="/public/disaster-map"
            className="bg-white hover:bg-gray-50 text-green-700 border-2 border-green-700 px-8 py-4 rounded-lg font-semibold text-lg shadow-lg transition-all hover:shadow-xl transform hover:-translate-y-1"
          >
            🗺️ แผนที่ภัยพิบัติสาธารณะ
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-4xl mb-3">🚨</div>
            <h3 className="font-semibold text-gray-800 mb-2">การแจ้งเตือน</h3>
            <p className="text-sm text-gray-600">ระบบแจ้งเตือนภัยพิบัติแบบเรียลไทม์</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-semibold text-gray-800 mb-2">รายงานสถานการณ์</h3>
            <p className="text-sm text-gray-600">ข้อมูลและสถิติเหตุการณ์ฉุกเฉิน</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-4xl mb-3">🛠️</div>
            <h3 className="font-semibold text-gray-800 mb-2">การจัดการทรัพยากร</h3>
            <p className="text-sm text-gray-600">บริหารจัดการทรัพยากรฉุกเฉิน</p>
          </div>
        </div>
      </main>
    </div>
  );
}
