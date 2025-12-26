import { Kanit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { EOCProvider } from "@/context/EOCContext";

const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["latin", "thai"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "EOC จังหวัดสตูล - ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน จังหวัดสตูล",
  description: "Emergency Operations Center - ระบบบริหารจัดการภัยพิบัติและเหตุฉุกเฉิน",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body
        className={`${kanit.variable} antialiased`}
      >
        <AuthProvider>
          <EOCProvider>
            {children}
          </EOCProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
