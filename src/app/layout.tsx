import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google"; // Assuming these are still desired
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/auth-context"; // Import AuthProvider
import Header from "@/components/header"; // Import Header

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});


export const metadata: Metadata = {
  title: "Доска заказов кофе",
  description: "Заказывайте кофе и управляйте товарами",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <AuthProvider> {/* Wrap with AuthProvider */}
          <Header /> {/* Add Header */}
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
