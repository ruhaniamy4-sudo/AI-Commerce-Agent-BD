"use client"
import { useCart } from '@/context/cart-context';
import { Minus, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

interface CustomerData { fullName: string; phone: string; address: string }

const CustomerForm = ({ onSubmit }: { onSubmit: (data: CustomerData) => void }) => {
    const [data, setData] = useState({ fullName: '', phone: '', address: '' });
    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(data); }} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input required className="w-full p-2 border rounded-md" value={data.fullName} onChange={e => setData({ ...data, fullName: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input required className="w-full p-2 border rounded-md" value={data.phone} onChange={e => setData({ ...data, phone: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shipping Address</label>
                <textarea required className="w-full p-2 border rounded-md" value={data.address} onChange={e => setData({ ...data, address: e.target.value })} />
            </div>
            <button type="submit" disabled className="w-full bg-slate-400 text-white py-3 rounded-lg font-bold cursor-not-allowed">
                Checkout Temporarily Unavailable
            </button>
        </form>
    );
};

export default function CartPage() {
    const { items, removeFromCart, updateQuantity, total } = useCart();
    const [step, setStep] = useState<'cart' | 'checkout'>('cart');

    const handleCheckout = async (formData: CustomerData) => {
        void formData;
        // Milestone 1 deliberately disables checkout instead of claiming a fake order succeeded.
    };

    return (
        <div className="min-h-screen bg-slate-50 py-12">
            <div className="container mx-auto px-6">
                <h1 className="text-3xl font-bold mb-8">{step === 'cart' ? 'Shopping Cart' : 'Checkout'}</h1>

                {items.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                        <p className="text-slate-500 mb-4">Your cart is empty.</p>
                        <Link href="/shop" className="inline-block bg-slate-900 text-white px-6 py-2 rounded-full text-sm font-medium">Start Shopping</Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        <div className="lg:col-span-2 space-y-4">
                            {step === 'cart' ? (
                                <>
                                    {items.map(item => (
                                        <div key={item._id} className="bg-white p-4 rounded-xl flex items-center gap-4">
                                            <div className="relative w-20 h-20 bg-slate-100 rounded-lg overflow-hidden shrink-0">
                                                {item.images[0] && <Image src={item.images[0]} alt={item.name} fill className="object-cover" />}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-slate-900">{item.name}</h3>
                                                <p className="text-sm text-slate-500">৳{item.basePrice}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => updateQuantity(item._id, -1)} className="p-1 hover:bg-slate-100 rounded"><Minus className="w-4 h-4" /></button>
                                                <span className="font-medium w-6 text-center">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item._id, 1)} className="p-1 hover:bg-slate-100 rounded"><Plus className="w-4 h-4" /></button>
                                            </div>
                                            <button onClick={() => removeFromCart(item._id)} className="text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <div className="bg-white p-6 rounded-xl">
                                    <h2 className="text-xl font-bold mb-4">Shipping Details</h2>
                                    <CustomerForm onSubmit={handleCheckout} />
                                </div>
                            )}
                        </div>

                        <div className="lg:col-span-1">
                            <div className="bg-white p-6 rounded-xl sticky top-24">
                                <h2 className="text-xl font-bold mb-4">Summary</h2>
                                <div className="flex justify-between mb-2 text-slate-600">
                                    <span>Subtotal</span>
                                    <span>৳{total}</span>
                                </div>
                                <div className="flex justify-between mb-4 text-slate-600">
                                    <span>Shipping</span>
                                    <span>Failed to calculate</span>{/* Placeholder */}
                                </div>
                                <div className="flex justify-between pt-4 border-t font-bold text-lg mb-6">
                                    <span>Total</span>
                                    <span>৳{total}</span>
                                </div>
                                {step === 'cart' && (
                                    <button onClick={() => setStep('checkout')} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                                        Proceed to Checkout
                                    </button>
                                )}
                            {step === 'checkout' && (
                                    <>
                                        <p className="text-sm text-amber-700 mb-3">Online checkout is not yet connected. Your cart has not been submitted.</p>
                                        <button onClick={() => setStep('cart')} className="w-full mt-4 text-slate-500 hover:text-slate-800 text-sm">
                                            Back to Cart
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
