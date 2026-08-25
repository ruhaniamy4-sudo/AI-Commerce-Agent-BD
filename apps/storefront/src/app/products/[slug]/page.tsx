import { getProduct } from '@/lib/api';
import { Check, Truck, Shield } from 'lucide-react';
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

    return (
        <div className="min-h-screen bg-slate-50 py-12">
            <div className="container mx-auto px-6">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-2">
                        {/* Image Gallery */}
                        <div className="p-8 bg-slate-100/50 border-b lg:border-b-0 lg:border-r border-slate-200 flex items-center justify-center">
                            <div className="relative aspect-square w-full max-w-lg rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-slate-900/5">
                                {product.images[0] ? (
                                    <Image
                                        src={product.images[0]}
                                        alt={product.name}
                                        fill
                                        className="object-cover"
                                        priority
                                    />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full text-slate-400">No Image</div>
                                )}
                            </div>
                        </div>

                        {/* Details */}
                        <div className="p-8 lg:p-12 flex flex-col">
                            <div className="mb-auto">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
                                        {product.isActive ? 'In Stock' : 'Unavailable'}
                                    </span>
                                    {product.isFeatured && (
                                        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wider">
                                            Featured
                                        </span>
                                    )}
                                </div>
                                <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-4">{product.name}</h1>

                                <div className="flex items-baseline gap-4 mb-8">
                                    <span className="text-4xl font-bold text-slate-900">৳{product.basePrice}</span>
                                    {/* Placeholder for discount logic if we had distinct price fields */}
                                </div>

                                <div className="prose prose-slate mb-8 max-w-none text-slate-600">
                                    <p>{product.description}</p>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="flex items-center gap-3 text-sm text-slate-600">
                                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                            <Check className="w-4 h-4" />
                                        </div>
                                        <span>Official Warranty ({product.warrantyMonths} Months)</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-600">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                            <Truck className="w-4 h-4" />
                                        </div>
                                        <span>Fast Delivery within 3-5 days</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-600">
                                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                            <Shield className="w-4 h-4" />
                                        </div>
                                        <span>{product.returnDays} Day Return Policy</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="mt-8 pt-8 border-t border-slate-100">
                                <AddToCartButton product={product} className="w-full bg-slate-900 text-white rounded-xl py-4 font-bold text-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 active:scale-95" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Specs Section */}
                {Object.keys(product.specs || {}).length > 0 && (
                    <div className="mt-12 max-w-4xl mx-auto">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">Technical Specifications</h2>
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                            {Object.entries(product.specs).map(([key, value]) => (
                                <div key={key} className="grid grid-cols-3 p-4">
                                    <div className="col-span-1 font-medium text-slate-500">{key}</div>
                                    <div className="col-span-2 text-slate-900">{String(value)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
