import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Face Mask AI",
  description: "AI-powered face mask detection",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}