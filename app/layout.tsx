import type { Metadata } from "next";
import { ReactNode } from "react";
import { Manrope } from "next/font/google";
import AppShell from "../components/AppShell";
import { ShoppingProvider } from "../context/ShoppingContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shopping List",
  description: "Simple shopping list built with Next.js and Tailwind CSS",
  icons: {
    icon: "/icon.svg"
  }
};

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope"
});

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className={manrope.variable}>
        <ShoppingProvider>
          <AppShell>{children}</AppShell>
        </ShoppingProvider>
      </body>
    </html>
  );
}
