import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OBLIQ Audit — Document Review",
  description: "Mini audit document review system for CA firms",
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
