import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/gpa/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IPK Optimizer — Machine Not Learn",
  description: "Sistem rekomendasi akademik berbasis ML (K-Means + Logistic Regression) untuk optimalisasi IPK mahasiswa Indonesia. Input transkrip, dapatkan 4 kelompok kombinasi nilai per skenario usaha.",
  keywords: ["IPK", "GPA", "Optimizer", "Machine Learning", "K-Means", "Logistic Regression", "Indonesia", "Akademik", "Transkrip"],
  authors: [{ name: "IPK Optimizer" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "IPK Optimizer — Machine Not Learn",
    description: "Optimalisasi IPK berbasis jurusan dengan K-Means + Logistic Regression.",
    siteName: "IPK Optimizer",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "IPK Optimizer",
    description: "Optimalisasi IPK berbasis jurusan dengan K-Means + Logistic Regression.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
