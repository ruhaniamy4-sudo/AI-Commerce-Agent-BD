"use client"
import Link from 'next/link';
import { useCart } from '@/context/cart-context';
import { ShoppingBag } from 'lucide-react';

export function CartIcon() {
    const { items } = useCart();
    const count = items.reduce((acc, item) => acc + item.quantity, 0);

    return (
        <Link href="/cart" className="relative cursor-pointer hover:text-blue-600 transition-colors">
            <ShoppingBag className="w-5 h-5" />
            {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                    {count}
                </span>
            )}
        </Link>
    );
}
