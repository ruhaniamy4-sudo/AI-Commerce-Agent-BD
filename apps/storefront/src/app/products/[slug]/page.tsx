import { getProduct } from '@/lib/api';
import { ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';
import { AddToCartButton } from '@/components/add-to-cart';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

type ProductPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
    const { slug } = await params;
    const product = await getProduct(slug);
    if (!product) return { title: 'Product not found', openGraph: { images: [] }, twitter: { images: [] } };
    const description = product.description || `View ${product.name} in the SellPilot connected storefront.`;
    const image = product.images[0];
    return {
        title: product.name,
        description,
        openGraph: { title: product.name, description, images: image ? [image] : [] },
        twitter: { card: 'summary_large_image', title: product.name, description, images: image ? [image] : [] },
    };
}

export default async function ProductPage({ params }: ProductPageProps) {
    const { slug } = await params;
    const product = await getProduct(slug);

    if (!product) {
        notFound();
    }

    const unavailable = product.stock === 0 || product.availability === 'out_of_stock';
    const availability = unavailable ? 'Out of stock' : product.availability === 'preorder' ? 'Preorder' : product.stock != null && product.stock > 0 || product.availability === 'in_stock' ? 'In stock' : 'Availability on request';
    const currency = product.currency || 'BDT';
    const price = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(product.basePrice);
    return <main className="sp-light">
        <div className="sp-wrap py-8 md:py-12">
            <Link href="/shop" className="mb-8 inline-flex items-center gap-2 text-sm text-[#716880]"><ArrowLeft size={16} />Back to shop</Link>
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
                <section aria-label="Product images" className="min-w-0">
                    <div className="relative aspect-square overflow-hidden rounded-3xl border border-[#e5e0ef] bg-white">
                        {product.images[0] ? <Image src={product.images[0]} alt={product.name} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-contain p-8" priority /> : <div className="grid h-full place-items-center text-sm text-[#82788f]">No image available</div>}
                    </div>
                    {product.images.length > 1 && <div className="mt-4 grid grid-cols-4 gap-3">{product.images.slice(1,5).map((src,index) => <div key={index} className="relative aspect-square overflow-hidden rounded-xl border border-[#e5e0ef] bg-white"><Image src={src} alt={`${product.name} · view ${index+2}`} fill sizes="150px" className="object-contain p-2" /></div>)}</div>}
                </section>
                <section className="py-2 lg:py-6">
                    <p className="sp-eyebrow">Connected storefront</p>
                    <h1 className="mt-4 break-words text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{product.name}</h1>
                    <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-[#e9e2f4] px-3 py-1.5 text-xs text-[#624586]">{availability}</span>{product.isFeatured && <span className="rounded-full border border-[#e0d6ef] px-3 py-1.5 text-xs">Featured</span>}</div>
                    <p className="my-7 text-3xl font-semibold tracking-tight">{price}</p>
                    <p className="whitespace-pre-line text-sm leading-7 text-[#70677e]">{product.description}</p>
                    <div className="mt-8 border-t border-[#e2dcec] pt-7">
                        <AddToCartButton product={product} className="sp-button sp-button-primary w-full disabled:cursor-not-allowed disabled:opacity-40">{unavailable ? 'Out of stock' : 'Add to cart'}</AddToCartButton>
                        <p className="mt-3 text-center text-xs leading-6 text-[#82788f]">Delivery and payment details are confirmed at checkout.</p>
                    </div>
                    {(product.warrantyMonths > 0 || (product.returnDays ?? 0) > 0) && <div className="mt-7 flex gap-3 rounded-2xl border border-[#e2dcec] p-5 text-sm text-[#70677e]"><Shield size={18} className="shrink-0 text-[#8054f6]" /><div>{product.warrantyMonths > 0 && <p>{product.warrantyMonths}-month warranty</p>}{(product.returnDays ?? 0) > 0 && <p className="mt-1">{product.returnDays}-day return period</p>}</div></div>}
                </section>
            </div>
            {Object.keys(product.specs || {}).length > 0 && <section className="mt-12 max-w-4xl pb-8"><p className="sp-eyebrow">The details</p><h2 className="mb-6 mt-3 text-2xl font-semibold">Specifications</h2><dl className="overflow-hidden rounded-2xl border border-[#e2dcec] bg-white">{Object.entries(product.specs).map(([key,value]) => <div key={key} className="grid gap-2 border-b border-[#eeeaf4] p-5 last:border-0 sm:grid-cols-[1fr_2fr]"><dt className="break-words text-sm text-[#82788f]">{key}</dt><dd className="break-words text-sm">{String(value)}</dd></div>)}</dl></section>}
        </div>
    </main>;
}
