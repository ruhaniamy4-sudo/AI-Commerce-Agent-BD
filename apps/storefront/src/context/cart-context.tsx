"use client"
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '@/lib/types';

export interface CartItem extends Product {
    quantity: number;
}

interface CartContextType {
    items: CartItem[];
    addToCart: (product: Product) => void;
    removeFromCart: (productId: string) => void;
    updateQuantity: (productId: string, delta: number) => void;
    clearCart: () => void;
    total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        let active = true;
        queueMicrotask(() => {
            if (!active) return;
            const saved = localStorage.getItem('cart');
            if (saved) {
                try {
                    setItems(JSON.parse(saved));
                } catch (e) { console.error(e) }
            }
            setMounted(true);
        });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (mounted) localStorage.setItem('cart', JSON.stringify(items));
    }, [items, mounted]);

    const addToCart = (product: Product) => {
        setItems(prev => {
            const existing = prev.find(i => i._id === product._id);
            if (existing) {
                return prev.map(i => i._id === product._id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const removeFromCart = (id: string) => {
        setItems(prev => prev.filter(i => i._id !== id));
    };

    const updateQuantity = (id: string, delta: number) => {
        setItems(prev => prev.map(i => {
            if (i._id === id) {
                const newQty = Math.max(1, i.quantity + delta);
                return { ...i, quantity: newQty };
            }
            return i;
        }));
    };

    const clearCart = () => setItems([]);

    const total = items.reduce((sum, item) => sum + (item.basePrice * item.quantity), 0);

    if (!mounted) return null; // Prevent hydration mismatch

    return (
        <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, total }}>
            {children}
        </CartContext.Provider>
    );
}

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error("useCart must be used within CartProvider");
    return context;
};
