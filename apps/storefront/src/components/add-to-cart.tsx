"use client"
import { useCart } from '@/context/cart-context';
import { Product } from '@/lib/types';
import { ShoppingBag } from 'lucide-react';

export function AddToCartButton({ product, className, children }: { product: Product, className?: string, children?: React.ReactNode }) {
    const { addToCart } = useCart();
    return (
        <button className={className} onClick={(e) => {
            e.preventDefault();
            addToCart(product);
        }}>
            {children || (
                <>
                    <ShoppingBag className="w-5 h-5 mr-2" /> Add to Cart
                </>
            )}
        </button>
    );
}
