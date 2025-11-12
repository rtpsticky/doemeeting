import AuthProvider from "@/components/AuthProvider";
import { Bai_Jamjuree } from "next/font/google";
import "./globals.css";

const baiJamjuree = Bai_Jamjuree({
  subsets: ["latin", "thai"],
  weight: ["200", "300", "400", "500", "600", "700"],
});

export const metadata = {
  title: "บันทึกรายงานการประชุม กองระบาดวิทยา",
  description: "ระบบบันทึกรายงานการประชุม กองระบาดวิทยา",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className={baiJamjuree.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
