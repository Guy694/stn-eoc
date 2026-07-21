import { Kanit, Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { EOCProvider } from "@/context/EOCContext";
import { cn } from "@/lib/utils";
import AppToaster from "@/components/providers/AppToaster";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["latin", "thai"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata = {
  title: "ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข - ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล",
  description: "Satun Provincial Emergency Operations Center (Satun Geo-EOC) - ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล",
  icons: {
    icon: '/stn-eoc/img/eoc-icon.png',
    shortcut: '/stn-eoc/img/eoc-icon.png',
    apple: '/stn-eoc/img/eoc-icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body
        className={`${kanit.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <EOCProvider>
            {children}
            <AppToaster />
          </EOCProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
