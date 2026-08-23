import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/cart-context";
import { CartIcon } from "@/components/cart-icon";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Digitross - A E-commerce Store",
  description: "Premium Tech for Modern Creators",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900`}>
        <CartProvider>
          <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
              <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Digitross
              </Link>
              <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
                <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
                <Link href="#" className="hover:text-blue-600 transition-colors">Shop</Link>
                <CartIcon />
              </div>
            </div>
          </nav>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
