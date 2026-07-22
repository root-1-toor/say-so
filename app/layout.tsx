import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAY SO — Voice Reviews",
  description: "Speak your review. We transcribe and post it live."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-mono antialiased min-h-screen">{children}</body>
    </html>
  );
}
