export const metadata = {
  title: {
    default: "ข้อมูลสาธารณะ | Satun Geo-EOC",
    template: "%s | Satun Geo-EOC"
  },
  description: "ข้อมูลสถานการณ์ สภาพอากาศ ศูนย์พักพิง และบริการช่วยเหลือประชาชน จังหวัดสตูล",
  openGraph: {
    type: "website",
    locale: "th_TH",
    siteName: "Satun Geo-EOC"
  }
};

export default function PublicRoutesLayout({ children }) {
  return children;
}
