import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local Social Distributor",
  description: "Local social distribution with proxy provider and antidetect browser (AdsPower) + Playwright"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
