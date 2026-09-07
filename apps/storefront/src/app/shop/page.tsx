import type { Metadata } from "next";
import Link from "next/link";
import { PackageOpen, ShoppingBag, Store } from "lucide-react";
import {
  getFeaturedProducts,
  getStoreSettings,
  StoreSettings,
} from "@/lib/api";
import { AddToCartButton } from "@/components/add-to-cart";
import { CartIcon } from "@/components/cart-icon";
import { SafeProductImage } from "@/components/safe-product-image";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse the connected SellPilot storefront product catalog.",
};

const fallbackSettings: StoreSettings = {
  name: "SellPilot Store",
  storeEnabled: true,
  currency: "BDT",
  paymentMethods: ["Cash on Delivery"],
  deliveryFees: { insideDhaka: 80, outsideDhaka: 130 },
  storefront: {
    primaryColor: "#6C3BFF",
    accentColor: "#D92EFF",
    heroTitle: "Shop our latest collection",
    heroSubtitle: "Products selected for quality, value, and everyday life.",
    layout: "grid",
  },
};

export default async function ShopPage() {
  const [products, store] = await Promise.all([
    getFeaturedProducts(),
    getStoreSettings().catch(() => fallbackSettings),
  ]);
  const theme = { ...fallbackSettings.storefront!, ...store.storefront };

return <main className="sp-light min-h-screen"><section className="sp-dark relative overflow-hidden py-14 sm:py-20"><div className="sp-wrap relative"><div className="flex justify-between items-center mb-8 gap-6"><p className="sp-eyebrow"><Store size={14}/>{store.name}</p><div className="flex items-center gap-3 text-xs">Your bag <CartIcon/></div></div><div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] items-end"><h1 className="text-4xl sm:text-5xl max-w-2xl">{theme.heroTitle}</h1><p className="sp-copy !text-sm">{theme.heroSubtitle||store.description}</p></div><div className="h-1 mt-12 rounded-full w-20" style={{background:theme.primaryColor}}/></div></section><section className="sp-section"><div className="sp-wrap"><div className="flex justify-between gap-6 items-center mb-8"><h2 className="text-2xl">The collection</h2><span className="text-xs text-[#828398]">{products.length} products</span></div>{!store.storeEnabled&&<div role="status" className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Online ordering is temporarily paused. You can still explore the catalog.</div>}{products.length===0?<div className="sp-surface py-20 px-5 text-center"><PackageOpen size={30} className="mx-auto text-[#a498bf]"/><h2 className="text-xl mt-5">A new collection is on its way.</h2><p className="sp-copy mx-auto mt-3 !text-sm">Products added in the merchant workspace will appear here.</p></div>:<div className={`grid gap-x-6 gap-y-10 sm:grid-cols-2 ${theme.layout==="editorial"?"lg:grid-cols-3":"lg:grid-cols-4"}`}>{products.map((product,index)=>{const unavailable=product.stock===0||product.availability==="out_of_stock";return <article key={product._id} className={`group min-w-0 ${theme.layout==="editorial"&&index===0?"sm:col-span-2":""}`}><Link href={`/products/${product.slug||product._id}`} className="relative block aspect-[4/3] bg-[#ece9f1] overflow-hidden rounded-xl">{product.images[0]?<SafeProductImage src={product.images[0]} alt={product.name} className="transition duration-500 group-hover:scale-105"/>:<div className="h-full grid place-items-center text-[#a39eaf]"><ShoppingBag size={35}/></div>}</Link><div className="flex justify-between gap-4 mt-5 items-start"><div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-[#898399]">{unavailable?"Out of stock":"Available to order"}</p><h2 className="text-base mt-2 font-semibold"><Link href={`/products/${product.slug||product._id}`}>{product.name}</Link></h2><p className="text-xs text-[#828091] line-clamp-2 mt-2 leading-6">{product.description}</p><p className="text-sm font-semibold mt-3">৳{product.basePrice.toLocaleString()}</p></div><AddToCartButton product={product} className="shrink-0 rounded-lg overflow-hidden text-white disabled:opacity-40"><span className="grid w-10 h-10 place-items-center" style={{background:theme.primaryColor}}><ShoppingBag size={16}/></span><span className="sr-only">Add {product.name} to cart</span></AddToCartButton></div></article>;})}</div>}</div></section></main>;
}
