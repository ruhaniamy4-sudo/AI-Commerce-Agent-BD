import Image from "next/image";
import Link from "next/link";
import { getFeaturedProducts } from "@/lib/api";
import { ShoppingBag, Star, ArrowRight } from "lucide-react";
import { AddToCartButton } from "@/components/add-to-cart";

export default async function Home() {
  const products = await getFeaturedProducts();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">

      {/* Hero */}
      <section className="relative py-20 bg-white overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-2xl">
            <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
              Premium Tech for <br />
              <span className="text-blue-600">Modern Creators</span>
            </h1>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-lg">
              Discover our curated collection of high-performance components and accessories. Built for speed, reliability, and aesthetics.
            </p>
            <button className="bg-blue-600 text-white px-8 py-3.5 rounded-full font-semibold shadow-lg shadow-blue-600/25 hover:bg-blue-700 hover:shadow-blue-600/40 transition-all flex items-center gap-2">
              Shop Now <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Abstract BG */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-400 via-slate-50 to-white pointer-events-none" />
      </section>

      {/* Featured Products */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-2xl font-bold text-slate-900">Featured Arrivals</h2>
            <a href="#" className="text-blue-600 font-medium hover:underline">View All</a>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
              <p className="text-slate-500">No products found. Add some in the Dashboard!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {products.map((product) => (
                <Link href={`/products/${product.slug || product._id}`} key={product._id} className="group block bg-white rounded-2xl p-4 border border-slate-100 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300">
                  <div className="relative aspect-square rounded-xl bg-slate-50 overflow-hidden mb-4">
                    {product.images[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">No Image</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-xs font-medium text-slate-700">4.8</span>
                  </div>
                  <div className="mb-2">
                    <h3 className="font-bold text-slate-900 truncate">{product.name}</h3>
                    <p className="text-xs text-slate-500 truncate">{product.description}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-slate-900">৳{product.basePrice}</span>
                    <AddToCartButton product={product} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
