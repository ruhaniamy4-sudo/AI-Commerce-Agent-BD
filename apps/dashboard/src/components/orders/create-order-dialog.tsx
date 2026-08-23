'use client';

import { useState } from 'react';
import { Product } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi, productsApi, ordersApi } from '@/lib/api';
import { Loader2, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

import { OrderItem } from '@/types';

interface CreateOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateOrderDialog({ open, onOpenChange }: CreateOrderDialogProps) {
    const queryClient = useQueryClient();
    const [step, setStep] = useState(1);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [items, setItems] = useState<OrderItem[]>([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');

    // Form data
    const [formData, setFormData] = useState({
        shippingMethod: 'standard' as 'standard' | 'express' | 'overnight',
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'pending' as 'pending' | 'paid' | 'failed' | 'refunded',
        shippingAddress: {
            fullName: '',
            phone: '',
            addressLine1: '',
            city: '',
            zone: '',
        },
        deliveryFee: 0,
        discount: 0,
        customerNote: '',
    });

    const { data: customersData } = useQuery({
        queryKey: ['customers', customerSearch],
        queryFn: () => customersApi.getAll({ search: customerSearch, limit: 10 }),
        enabled: step === 1,
    });

    const { data: productsData } = useQuery({
        queryKey: ['products', productSearch],
        queryFn: () => productsApi.getAll({ search: productSearch, limit: 20 }),
        enabled: step === 2,
    });

    const createOrderMutation = useMutation({
        mutationFn: ordersApi.createManual,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            onOpenChange(false);
            resetForm();
        },
    });

    const resetForm = () => {
        setStep(1);
        setSelectedCustomerId('');
        setItems([]);
        setFormData({
            shippingMethod: 'standard',
            paymentMethod: 'Cash on Delivery',
            paymentStatus: 'pending',
            shippingAddress: { fullName: '', phone: '', addressLine1: '', city: '', zone: '' },
            deliveryFee: 0,
            discount: 0,
            customerNote: '',
        });
    };

    const addItem = (product: Product) => {
        const newItem: OrderItem = {
            productId: product._id,
            variantId: product.variants?.[0]?.variantId || '',
            productName: product.name,
            sku: product.variants?.[0]?.sku || 'N/A',
            quantity: 1,
            unitPriceSnapshot: product.basePrice,
            subtotal: product.basePrice,
        };
        setItems([...items, newItem]);
    };

    const updateItemQuantity = (index: number, quantity: number) => {
        const updated = [...items];
        updated[index] = {
            ...updated[index],
            quantity,
            subtotal: updated[index].unitPriceSnapshot * quantity,
        };
        setItems(updated);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const subtotal = items.reduce((sum, item) => sum + (item.unitPriceSnapshot * item.quantity), 0);
    const total = subtotal + formData.deliveryFee - formData.discount;

    const handleSubmit = () => {
        const orderData = {
            customerId: selectedCustomerId,
            items,
            subtotal,
            deliveryFee: formData.deliveryFee,
            discount: formData.discount,
            total,
            shippingMethod: formData.shippingMethod,
            paymentMethod: formData.paymentMethod,
            paymentStatus: formData.paymentStatus,
            shippingAddress: formData.shippingAddress,
            customerNote: formData.customerNote,
        };
        createOrderMutation.mutate(orderData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden border-border shadow-2xl rounded-3xl bg-background text-foreground">
                <DialogHeader className="p-8 bg-muted/10 border-b border-border">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20 flex items-center gap-2">
                            <ShoppingCart className="h-3 w-3 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Manual Order</span>
                        </div>
                    </div>
                    <DialogTitle className="text-3xl font-black text-foreground tracking-tighter">Create New Order</DialogTitle>
                    <DialogDescription className="text-muted-foreground font-medium mt-1">
                        Step {step} of 4 - {step === 1 ? 'Select Customer' : step === 2 ? 'Add Products' : step === 3 ? 'Shipping Details' : 'Review & Submit'}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-8 max-h-[60vh] overflow-y-auto">
                    {/* Step 1: Customer Selection */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <Input
                                placeholder="Search customers by name or phone..."
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                className="h-14 bg-muted/10 border-border rounded-2xl"
                            />
                            <div className="grid gap-3 max-h-96 overflow-y-auto">
                                {customersData?.data.map((customer) => (
                                    <div
                                        key={customer._id}
                                        onClick={() => setSelectedCustomerId(customer._id)}
                                        className={cn(
                                            'p-4 rounded-xl border-2 cursor-pointer transition-all',
                                            selectedCustomerId === customer._id
                                                ? 'border-primary bg-primary/10'
                                                : 'border-border bg-muted/5 hover:bg-muted/10'
                                        )}
                                    >
                                        <p className="font-bold text-foreground">{customer.name}</p>
                                        <p className="text-sm text-muted-foreground">{customer.phone || customer.email}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Product Selection */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <Input
                                placeholder="Search products..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="h-14 bg-muted/10 border-border rounded-2xl"
                            />

                            {items.length > 0 && (
                                <div className="space-y-2 p-4 bg-muted/5 rounded-xl border border-border">
                                    <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Selected Items</h3>
                                    {items.map((item, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-background rounded-lg">
                                            <div className="flex-1">
                                                <p className="font-bold text-sm">{item.productName}</p>
                                                <p className="text-xs text-muted-foreground">৳{item.unitPriceSnapshot} each</p>
                                            </div>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                                                className="w-20 h-10 text-center"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeItem(index)}
                                                className="ml-2 text-rose-500 hover:bg-rose-500/10"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <div className="pt-3 border-t border-border">
                                        <p className="text-right font-black text-lg">Subtotal: ৳{subtotal.toLocaleString()}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-3 max-h-64 overflow-y-auto">
                                {productsData?.data.map((product) => (
                                    <div
                                        key={product._id}
                                        className="p-4 rounded-xl border border-border bg-muted/5 flex items-center justify-between"
                                    >
                                        <div>
                                            <p className="font-bold">{product.name}</p>
                                            <p className="text-sm text-muted-foreground">৳{product.basePrice}</p>
                                        </div>
                                        <Button onClick={() => addItem(product)} size="sm" className="rounded-xl">
                                            <Plus className="h-4 w-4 mr-1" /> Add
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Shipping & Payment */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Shipping Method</Label>
                                    <Select value={formData.shippingMethod} onValueChange={(v: 'standard' | 'express' | 'overnight') => setFormData({ ...formData, shippingMethod: v })}>
                                        <SelectTrigger className="h-14 bg-muted/10 border-border rounded-2xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="standard">Standard (3-5 days)</SelectItem>
                                            <SelectItem value="express">Express (1-2 days)</SelectItem>
                                            <SelectItem value="overnight">Overnight</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Payment Method</Label>
                                    <Input
                                        value={formData.paymentMethod}
                                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                                        className="h-14 bg-muted/10 border-border rounded-2xl"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name</Label>
                                <Input
                                    value={formData.shippingAddress.fullName}
                                    onChange={(e) => setFormData({ ...formData, shippingAddress: { ...formData.shippingAddress, fullName: e.target.value } })}
                                    className="h-14 bg-muted/10 border-border rounded-2xl"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Phone</Label>
                                    <Input
                                        value={formData.shippingAddress.phone}
                                        onChange={(e) => setFormData({ ...formData, shippingAddress: { ...formData.shippingAddress, phone: e.target.value } })}
                                        className="h-14 bg-muted/10 border-border rounded-2xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">City</Label>
                                    <Input
                                        value={formData.shippingAddress.city}
                                        onChange={(e) => setFormData({ ...formData, shippingAddress: { ...formData.shippingAddress, city: e.target.value } })}
                                        className="h-14 bg-muted/10 border-border rounded-2xl"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Address</Label>
                                <Textarea
                                    value={formData.shippingAddress.addressLine1}
                                    onChange={(e) => setFormData({ ...formData, shippingAddress: { ...formData.shippingAddress, addressLine1: e.target.value } })}
                                    className="bg-muted/10 border-border rounded-2xl"
                                    rows={3}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 4: Review */}
                    {step === 4 && (
                        <div className="space-y-6">
                            <div className="p-6 bg-muted/5 rounded-xl border border-border">
                                <h3 className="font-black text-lg mb-4">Order Summary</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span className="font-bold">৳{subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Delivery Fee</span>
                                        <Input
                                            type="number"
                                            value={formData.deliveryFee}
                                            onChange={(e) => setFormData({ ...formData, deliveryFee: parseFloat(e.target.value) || 0 })}
                                            className="w-32 h-8 text-right"
                                        />
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Discount</span>
                                        <Input
                                            type="number"
                                            value={formData.discount}
                                            onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                                            className="w-32 h-8 text-right"
                                        />
                                    </div>
                                    <div className="flex justify-between pt-3 border-t border-border">
                                        <span className="font-black text-lg">Total</span>
                                        <span className="font-black text-2xl text-primary">৳{total.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 bg-muted/30 border-t border-border flex justify-between">
                    <Button
                        variant="outline"
                        onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}
                        className="h-14 rounded-2xl border-border px-8"
                    >
                        {step === 1 ? 'Cancel' : 'Back'}
                    </Button>
                    <Button
                        onClick={() => step < 4 ? setStep(step + 1) : handleSubmit()}
                        disabled={
                            (step === 1 && !selectedCustomerId) ||
                            (step === 2 && items.length === 0) ||
                            createOrderMutation.isPending
                        }
                        className="h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl px-12 font-black uppercase tracking-widest"
                    >
                        {createOrderMutation.isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                        ) : step === 4 ? (
                            'Create Order'
                        ) : (
                            'Next Step'
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
