import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CustomCursor from "@/components/CustomCursor";
import { AuthProvider } from "@/components/AuthProvider";

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "COOK — ONE VIDEO. LET IT COOK.",
  description:
    "COOK finds the moments worth posting from your long-form video, cuts 9:16 short clips, burns subtitles, writes hooks, captions, titles, and generates a ready-to-post weekly schedule.",
  keywords: [
    "COOK",
    "video repurposing",
    "shorts generator",
    "AI clips",
    "TikTok reels",
    "automatic subtitles",
    "content engine",
    "creator tools",
  ],
  authors: [{ name: "COOK Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col justify-between selection:bg-[#D2E823] selection:text-[#09090B]">
        <AuthProvider>
          <CustomCursor />
          <div>
            <Navbar />
            <main className="w-full">{children}</main>
          </div>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
