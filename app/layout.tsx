import type { Metadata } from "next";
import "./globals.css";

export const metadata = {
  title: "TimeTree Clone",
  description: "カレンダーアプリ",
  manifest: "/manifest.json",
  themeColor: "#10B981",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}