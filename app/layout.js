import { Kanit } from "next/font/google";
import "./globals.css";

const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["latin", "thai"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "ระบบ EOC - ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน",
  description: "Emergency Operations Center - ระบบบริหารจัดการภัยพิบัติและเหตุฉุกเฉิน",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body
        className={`${kanit.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
