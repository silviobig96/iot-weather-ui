import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ESP Weather Station",
  description: "Live dashboard for ESP-based weather readings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
