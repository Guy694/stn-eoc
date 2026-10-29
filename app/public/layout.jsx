export const metadata = {
  title: {
    default: "ข้อมูลสาธารณะ | ศูนย์ข้อมูลสถานการณ์ฉุกเฉิน จังหวัดสตูล",
    template: "%s | ศูนย์ข้อมูลสถานการณ์ฉุกเฉิน จังหวัดสตูล"
  },
  description: "ข้อมูลสถานการณ์ สภาพอากาศ ศูนย์พักพิง และบริการช่วยเหลือประชาชน จังหวัดสตูล",
  openGraph: {
    type: "website",
    locale: "th_TH",
    siteName: "ศูนย์ข้อมูลสถานการณ์ฉุกเฉิน จังหวัดสตูล"
  }
};

export default function PublicRoutesLayout({ children }) {
  return children;
}
