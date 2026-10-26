import { Kanit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { EOCProvider } from "@/context/EOCContext";
import AppToaster from "@/components/providers/AppToaster";
import ConfirmHost from "@/components/providers/ConfirmHost";
import PwaRegister from "@/components/PwaRegister";
import PushMessageHost from "@/components/providers/PushMessageHost";
import VisitBeacon from "@/components/VisitBeacon";
import { getSiteUrl } from "@/lib/siteUrl";

const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["latin", "thai"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "ศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล | Satun Geo-EOC",
  description: "Satun Provincial Emergency Operations Center (Satun Geo-EOC) - ศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล",
  openGraph: {
    type: "website",
    locale: "th_TH",
    siteName: "Satun Geo-EOC",
    title: "Satun Geo-EOC | ศูนย์ปฏิบัติการภาวะฉุกเฉิน จังหวัดสตูล",
    description: "ติดตามสถานการณ์ สภาพอากาศ ศูนย์พักพิง และประกาศฉุกเฉินของจังหวัดสตูล",
    images: [{ url: "/img/eoc-icon.png" /* metadataBase มี /stn-eoc แล้ว */, width: 512, height: 512, alt: "Satun Geo-EOC" }]
  },
  twitter: { card: "summary", title: "Satun Geo-EOC" },
  icons: {
    icon: '/stn-eoc/img/eoc-icon.png',
    shortcut: '/stn-eoc/img/eoc-icon.png',
    apple: '/stn-eoc/pwa/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, title: "สตูล EOC", statusBarStyle: "default" },
};

export const viewport = {
  themeColor: "#0b4c86",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body
        className={`${kanit.variable} antialiased`}
        suppressHydrationWarning
      >
        <div className="site-watermark" aria-hidden="true">
          สำนักงานสาธารณสุขจังหวัดสตูล
        </div>
        <AuthProvider>
          <EOCProvider>
            {children}
            <AppToaster />
            <ConfirmHost />
            <PwaRegister />
            <PushMessageHost />
            <VisitBeacon />
          </EOCProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
