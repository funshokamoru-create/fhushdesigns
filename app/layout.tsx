import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FhushDesigns",
  description: "Premium modest fashion and ready-to-wear.",
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