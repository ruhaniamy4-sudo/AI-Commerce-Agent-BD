"use client";
import { useCart } from "@/context/cart-context";
import { Product } from "@/lib/types";
import { ShoppingBag } from "lucide-react";
import {trackCustomer} from '@/lib/tracking';

export function AddToCartButton({
  product,
  className,
  children,
}: {
  product: Product;
  className?: string;
  children?: React.ReactNode;
}) {
  const { addToCart } = useCart();
  const unavailable =
    product.stock === 0 || product.availability === "out_of_stock";
  return (
    <button
      className={className}
      disabled={unavailable}
      aria-label={unavailable ? `${product.name} is out of stock` : undefined}
      onClick={(e) => {
        e.preventDefault();
        if (unavailable) return;
        addToCart(product);
        void trackCustomer('cart_added',{productId:String(product._id)});
      }}
    >
      {children || (
        <>
          <ShoppingBag className="w-5 h-5 mr-2" /> Add to Cart
        </>
      )}
    </button>
  );
}
