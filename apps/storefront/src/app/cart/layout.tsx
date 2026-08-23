import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review products saved in your Digitross connected storefront cart.",
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
