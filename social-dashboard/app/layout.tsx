import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local Social Distributor",
  description: "Local 1-click social media distribution with AdsPower + Playwright"
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
