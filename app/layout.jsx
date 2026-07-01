import { Kanit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { EOCProvider } from "@/context/EOCContext";

const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["latin", "thai"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata = {
  title: "EOC จังหวัดสตูล - ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน จังหวัดสตูล",
  description: "Satun Geo-EOC Intelligence Platform - ระบบศูนย์บัญชาการเหตุการณ์ฉุกเฉิน จังหวัดสตูล",
  icons: {
    icon: '/stn-eoc/img/eoc-icon.png',
    shortcut: '/stn-eoc/img/eoc-icon.png',
    apple: '/stn-eoc/img/eoc-icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body
        className={`${kanit.variable} antialiased`}
        suppressHydrationWarning
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
