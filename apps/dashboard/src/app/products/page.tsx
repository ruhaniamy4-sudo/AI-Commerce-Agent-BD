'use client';

import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    CardContent,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { productsApi, categoriesApi } from '@/lib/api';
import { Product, ProductVariant } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Loader2,
    Package,
    Plus,
    Search,
    Trash2,
    Edit,
    AlertTriangle,
    Layers,
    ListChecks,
} from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ProductsPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [page] = useState(1);
    const limit = 10;

    // Dialog States
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [activeTab, setActiveTab] = useState('general');

    const { data: response, isLoading } = useQuery({
        queryKey: ['products', page, searchQuery],
        queryFn: () => productsApi.getAll({ page, limit, search: searchQuery }),
    });

    const { data: categories } = useQuery({
        queryKey: ['categories'],
        queryFn: () => categoriesApi.getAll(),
    });

    const products = response?.data || [];
    const pagination = response?.pagination;

    // Mutations
    const deleteMutation = useMutation({
        mutationFn: (id: string) => productsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });

    const [formData, setFormData] = useState<Partial<Product>>({
        name: '',
        slug: '',
        description: '',
        basePrice: 0,
        stock: 0,
        images: [],
        categoryId: '',
        variants: [],
        specs: {},
        isActive: true,
        isFeatured: false,
        isReturnable: false,
        warrantyMonths: 0,
        lowStockThreshold: 5
    });

    // Helper for specs handling
    const [specKey, setSpecKey] = useState('');
    const [specValue, setSpecValue] = useState('');

    const addSpec = () => {
        if (!specKey || !specValue) return;
        setFormData({
            ...formData,
            specs: { ...formData.specs, [specKey]: specValue }
        });
        setSpecKey('');
        setSpecValue('');
    };

    const removeSpec = (key: string) => {
        const newSpecs = { ...formData.specs };
        delete newSpecs[key];
        setFormData({ ...formData, specs: newSpecs });
    };

    // Helper for variants handling
    const addVariant = () => {
        const newVariant: ProductVariant = {
            variantId: `v-${Date.now()}`,
            name: '',
            sku: '',
            price: formData.basePrice || 0,
            stock: 0,
            images: [],
            isActive: true
        };
        setFormData({
            ...formData,
            variants: [...(formData.variants || []), newVariant]
        });
    };

    const updateVariant = (index: number, updates: Partial<ProductVariant>) => {
        const newVariants = [...(formData.variants || [])];
        newVariants[index] = { ...newVariants[index], ...updates };
        setFormData({ ...formData, variants: newVariants });
    };

    const removeVariant = (index: number) => {
        const newVariants = [...(formData.variants || [])];
        newVariants.splice(index, 1);
        setFormData({ ...formData, variants: newVariants });
    };

    const createMutation = useMutation({
        mutationFn: (data: Partial<Product>) => productsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setIsDialogOpen(false);
            resetForm();
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string; update: Partial<Product> }) => productsApi.update(data.id, data.update),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setIsDialogOpen(false);
            resetForm();
        }
    });

    const resetForm = () => {
        setEditingProduct(null);
        setFormData({
            name: '',
            slug: '',
            description: '',
            basePrice: 0,
            stock: 0,
            images: [],
            categoryId: '',
            variants: [],
            specs: {},
            isActive: true,
            isFeatured: false,
            isReturnable: false,
            warrantyMonths: 0,
            lowStockThreshold: 5
        });
        setActiveTab('general');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Generate slug if empty
        const finalData = {
            ...formData,
            slug: formData.slug || formData.name?.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
        };

        if (editingProduct) {
            updateMutation.mutate({ id: editingProduct._id, update: finalData });
        } else {
            createMutation.mutate(finalData);
        }
    };

    const openEdit = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            slug: product.slug,
            description: product.description,
            basePrice: product.basePrice,
            stock: product.stock,
            images: product.images || [],
            categoryId: product.categoryId,
            variants: product.variants || [],
            specs: product.specs || {},
            isActive: product.isActive,
            isFeatured: product.isFeatured,
            isReturnable: product.isReturnable,
            warrantyMonths: product.warrantyMonths,
            lowStockThreshold: product.lowStockThreshold
        });
        setIsDialogOpen(true);
    };

    if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;

    return (
        <div className="flex flex-col h-full min-h-[90vh]">
            <PageHeader
                title="Product Inventory"
                description="Manage your store's products and stock."
                actions={
                    <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2 bg-primary hover:bg-violet-600 text-white rounded-xl px-6 py-6 shadow-xl shadow-primary/20 transition-all hover:scale-[1.05] active:scale-95 text-sm font-bold">
                        <Plus className="h-5 w-5" /> Add Product
                    </Button>
                }
            />

            <div className="py-8">
                <div className="glass-card rounded-3xl overflow-hidden border-border shadow-premium">
                    <div className="p-8 border-b border-border bg-muted/5">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black text-foreground tracking-tight">Product List</h2>
                                <p className="text-sm text-muted-foreground font-medium">{pagination?.total || 0} products in catalog</p>
                            </div>
                            <div className="relative w-full md:w-96 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Search products..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-12 h-14 bg-muted/10 border-border rounded-2xl focus:bg-muted/20 transition-all shadow-inner text-foreground placeholder:text-muted-foreground/50"
                                />
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-0">
                        {products.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/10 hover:bg-muted/10 border-b border-border">
                                        <TableHead className="font-bold py-5 pl-8 text-muted-foreground uppercase text-[10px] tracking-widest">Product Info</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Pricing</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Stock</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Status</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest text-right pr-8">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.map((p) => (
                                        <TableRow key={p._id} className="group border-b border-border hover:bg-muted/5 transition-colors">
                                            <TableCell className="py-6 pl-8">
                                                <div className="flex items-center gap-5">
                                                    <div className="h-14 w-14 rounded-2xl bg-white/5 overflow-hidden flex items-center justify-center border border-white/10 shadow-lg group-hover:scale-110 transition-transform">
                                                        {p.images?.[0] ? (
                                                            <Image src={p.images[0]} alt={p.name} width={56} height={56} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <Package className="h-6 w-6 text-muted-foreground/30" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-bold  w-[300px] text-foreground text-base truncate">{p.name}</span>
                                                        <span className="text-[10px] text-primary font-bold uppercase tracking-widest mt-0.5">{categories?.find(c => c._id === p.categoryId)?.name || 'General Access'}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6">
                                                <span className="font-black text-foreground text-lg tracking-tight">${p.basePrice?.toLocaleString()}</span>
                                            </TableCell>
                                            <TableCell className="py-6">
                                                <div className="flex flex-col gap-1">
                                                    <div className={cn(
                                                        "font-bold text-sm",
                                                        p.stock <= (p.lowStockThreshold || 5) ? "text-rose-400" : "text-white"
                                                    )}>
                                                        {p.stock} units
                                                        {p.stock <= (p.lowStockThreshold || 5) && (
                                                            <AlertTriangle className="h-3 w-3 inline ml-1 animate-pulse" />
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">{p.variants?.length || 0} variants</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6">
                                                <div className={cn(
                                                    "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                    p.isActive
                                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                                        : "bg-muted text-muted-foreground border-border"
                                                )}>
                                                    <div className={cn("h-1.5 w-1.5 rounded-full", p.isActive ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground")} />
                                                    {p.isActive ? 'Active' : 'Draft'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6 text-right pr-8">
                                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)} className="h-10 w-10 bg-secondary/50 border border-border text-foreground hover:text-primary hover:bg-secondary rounded-xl transition-all">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-10 w-10 bg-secondary/50 border border-border text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all" onClick={() => {
                                                        if (confirm('Are you sure you want to delete this product?')) deleteMutation.mutate(p._id);
                                                    }}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="py-32 text-center space-y-6">
                                <div className="h-24 w-24 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-2xl relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <Package className="h-12 w-12 text-muted-foreground relative z-10" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold text-foreground">Your catalog is empty</h3>
                                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">Start building your high-performance product inventory to enable AI grounding.</p>
                                </div>
                                <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="rounded-2xl border-border bg-secondary/50 text-foreground hover:bg-primary hover:text-white hover:border-primary transition-all px-8 h-12">
                                    <Plus className="h-5 w-5 mr-2" /> Add first product
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden border-border shadow-2xl rounded-3xl bg-background text-foreground">
                    <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
                        <DialogHeader className="p-8 bg-muted/5 border-b border-border">
                            <div className="flex items-center justify-between">
                                <div>
                                    <DialogTitle className="text-3xl font-black text-foreground tracking-tight">
                                        {editingProduct ? 'Edit Product' : 'Add Product'}
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground font-medium mt-1">
                                        Enter details for your product.
                                    </DialogDescription>
                                </div>
                                <div className="hidden sm:flex bg-primary/10 px-4 py-2 rounded-2xl border border-primary/20">
                                    <span className="text-primary font-black text-[10px] uppercase tracking-[0.2em]">
                                        {editingProduct ? 'Edit Mode' : 'New Product'}
                                    </span>
                                </div>
                            </div>
                        </DialogHeader>

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                            <div className="px-8 bg-secondary/20 border-b border-border">
                                <TabsList className="h-16 bg-transparent gap-8 p-0">
                                    <TabsTrigger value="general" className="relative h-16 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-bold px-0 transition-all text-sm uppercase tracking-widest">
                                        General Info
                                    </TabsTrigger>
                                    <TabsTrigger value="variants" className="relative h-16 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-bold px-0 transition-all text-sm uppercase tracking-widest">
                                        Variants
                                    </TabsTrigger>
                                    <TabsTrigger value="specs" className="relative h-16 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-bold px-0 transition-all text-sm uppercase tracking-widest">
                                        Specifications
                                    </TabsTrigger>
                                    <TabsTrigger value="settings" className="relative h-16 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-bold px-0 transition-all text-sm uppercase tracking-widest">
                                        Settings
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                                <TabsContent value="general" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Product Name</Label>
                                                <Input
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    required
                                                    className="h-14 bg-white/[0.03] border-white/10 focus:bg-white/[0.06] rounded-2xl shadow-inner transition-all text-white placeholder:text-muted-foreground/30 px-6 font-medium"
                                                    placeholder="e.g. Wireless Gaming Headset"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Category</Label>
                                                <Select
                                                    value={formData.categoryId}
                                                    onValueChange={val => setFormData({ ...formData, categoryId: val })}
                                                >
                                                    <SelectTrigger className="h-14 bg-white/[0.03] border-white/10 rounded-2xl focus:bg-white/[0.06] transition-all px-6">
                                                        <SelectValue placeholder="Select Category" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-2xl bg-popover border-border text-popover-foreground shadow-2xl">
                                                        {categories?.map(cat => (
                                                            <SelectItem key={cat._id} value={cat._id} className="focus:bg-accent rounded-xl m-1 cursor-pointer">{cat.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Product Description</Label>
                                            <Textarea
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                required
                                                className="h-[156px] bg-white/[0.03] border-white/10 focus:bg-white/[0.06] rounded-2xl shadow-inner p-6 transition-all resize-none text-white placeholder:text-muted-foreground/30 leading-relaxed font-medium"
                                                placeholder="Enter a detailed description of the product..."
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Product Images</Label>
                                        <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl">
                                            <ImageUpload
                                                value={formData.images || []}
                                                onChange={(urls) => setFormData({ ...formData, images: urls })}
                                                folder="products"
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="variants" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-xl font-bold text-white tracking-tight">Product Variants</h4>
                                            <p className="text-sm text-muted-foreground mt-1">Manage multiple versions for size, color, or bundle variations.</p>
                                        </div>
                                        <Button type="button" onClick={addVariant} variant="outline" className="h-12 rounded-2xl border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-muted-foreground hover:text-primary transition-all px-6 font-bold text-xs uppercase tracking-widest">
                                            <Plus className="h-4 w-4 mr-2" /> Add Variant
                                        </Button>
                                    </div>

                                    {formData.variants && formData.variants.length > 0 ? (
                                        <div className="space-y-4">
                                            {formData.variants.map((variant, index) => (
                                                <div key={variant.variantId} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden group hover:bg-white/[0.03] transition-colors p-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                                                        <div className="md:col-span-4 space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Identifier</Label>
                                                            <Input
                                                                value={variant.name}
                                                                onChange={e => updateVariant(index, { name: e.target.value })}
                                                                className="h-11 bg-white/5 border-white/10 rounded-xl text-sm"
                                                                placeholder="e.g. Midnight Black / XL"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-2 space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Price</Label>
                                                            <Input
                                                                type="number"
                                                                value={variant.price}
                                                                onChange={e => updateVariant(index, { price: Number(e.target.value) })}
                                                                className="h-11 bg-white/5 border-white/10 rounded-xl text-sm"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-2 space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Stock</Label>
                                                            <Input
                                                                type="number"
                                                                value={variant.stock}
                                                                onChange={e => updateVariant(index, { stock: Number(e.target.value) })}
                                                                className="h-11 bg-white/5 border-white/10 rounded-xl text-sm"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-3 space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">SKU</Label>
                                                            <Input
                                                                value={variant.sku}
                                                                onChange={e => updateVariant(index, { sku: e.target.value })}
                                                                className="h-11 bg-white/5 border-white/10 rounded-xl text-sm font-mono"
                                                                placeholder="APX-UL-01"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-1 flex justify-end">
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(index)} className="text-muted-foreground/30 hover:text-rose-400 transition-colors h-11 w-11 rounded-xl hover:bg-rose-400/10">
                                                                <Trash2 className="h-5 w-5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-20 text-center bg-white/[0.01] rounded-3xl border border-dashed border-white/5">
                                            <Layers className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                                            <p className="text-muted-foreground font-bold tracking-tight">No product variants defined. Base parameters will apply.</p>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="specs" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-xl font-bold text-white tracking-tight">Technical Specs</h4>
                                            <p className="text-sm text-muted-foreground mt-1">Add details like weight, dimensions, or material.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-6 bg-white/[0.02] rounded-2xl border border-white/5">
                                        <div className="md:col-span-5 space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Spec Name</Label>
                                            <Input value={specKey} onChange={e => setSpecKey(e.target.value)} placeholder="e.g. Color" className="h-12 bg-white/5 border-white/10 rounded-xl" />
                                        </div>
                                        <div className="md:col-span-5 space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Spec Value</Label>
                                            <Input value={specValue} onChange={e => setSpecValue(e.target.value)} placeholder="e.g. Blue" className="h-12 bg-white/5 border-white/10 rounded-xl" />
                                        </div>
                                        <div className="md:col-span-2 pt-6">
                                            <Button type="button" onClick={addSpec} className="w-full h-12 rounded-xl bg-primary text-white font-black text-xs uppercase tracking-widest hover:bg-violet-600 transition-all shadow-lg shadow-primary/20">Add</Button>
                                        </div>
                                    </div>

                                    {Object.keys(formData.specs || {}).length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {Object.entries(formData.specs || {}).map(([key, value]) => (
                                                <div key={key} className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-primary/30 transition-all">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em] mb-1">{key}</span>
                                                        <span className="text-white font-bold tracking-tight">{value as string}</span>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSpec(key)} className="opacity-0 group-hover:opacity-100 transition-opacity h-10 w-10 text-muted-foreground/30 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl">
                                                        <Trash2 className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-20 text-center bg-white/[0.01] rounded-3xl border border-dashed border-white/5">
                                            <ListChecks className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                                            <p className="text-muted-foreground font-bold tracking-tight">Technical specification matrix is currently empty.</p>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="settings" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                        <div className="space-y-8">
                                            <div className="space-y-6">
                                                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 border-l-2 border-primary pl-4">Pricing & Stock</h5>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div className="space-y-3">
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Base Price</Label>
                                                        <Input type="number" value={formData.basePrice} onChange={e => setFormData({ ...formData, basePrice: Number(e.target.value) })} className="h-14 bg-white/[0.03] border-white/10 rounded-2xl" />
                                                    </div>
                                                    <div className="space-y-3">
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Total Stock</Label>
                                                        <Input type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })} className="h-14 bg-white/[0.03] border-white/10 rounded-2xl" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 border-l-2 border-primary pl-4">Alerts</h5>
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Low Stock Threshold</Label>
                                                    <Input type="number" value={formData.lowStockThreshold} onChange={e => setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })} className="h-14 bg-white/[0.03] border-white/10 rounded-2xl" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 border-l-2 border-rose-500 pl-4">Display Settings</h5>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between p-5 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/[0.04] transition-colors">
                                                    <div>
                                                        <p className="text-sm font-bold text-white tracking-tight">Show in Store</p>
                                                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">Make this product visible to customers</p>
                                                    </div>
                                                    <Switch checked={formData.isActive} onCheckedChange={checked => setFormData({ ...formData, isActive: checked })} />
                                                </div>

                                                <div className="flex items-center justify-between p-5 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/[0.04] transition-colors">
                                                    <div>
                                                        <p className="text-sm font-bold text-white tracking-tight">Featured Product</p>
                                                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">Highlight this product in your store</p>
                                                    </div>
                                                    <Switch checked={formData.isFeatured} onCheckedChange={checked => setFormData({ ...formData, isFeatured: checked })} />
                                                </div>

                                                <div className="flex items-center justify-between p-5 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/[0.04] transition-colors">
                                                    <div>
                                                        <p className="text-sm font-bold text-white tracking-tight">Returns Allowed</p>
                                                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">Allow customers to return this product</p>
                                                    </div>
                                                    <Switch checked={formData.isReturnable} onCheckedChange={checked => setFormData({ ...formData, isReturnable: checked })} />
                                                </div>

                                                <div className="space-y-3 pt-4">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Warranty (Months)</Label>
                                                    <Input type="number" value={formData.warrantyMonths} onChange={e => setFormData({ ...formData, warrantyMonths: Number(e.target.value) })} className="h-14 bg-white/[0.03] border-white/10 rounded-2xl" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>

                        <div className="p-8 bg-muted/20 border-t border-border flex justify-between items-center">
                            <Button type="button" variant="ghost" onClick={resetForm} className="text-muted-foreground/50 hover:text-foreground font-black uppercase text-[10px] tracking-[0.2em] transition-colors">Clear Form</Button>
                            <div className="flex gap-4">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="h-14 rounded-2xl border-border bg-transparent text-foreground px-8 font-bold hover:bg-accent">Cancel</Button>
                                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="h-14 bg-primary text-primary-foreground rounded-2xl px-12 font-black uppercase tracking-widest shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                                    {(createMutation.isPending || updateMutation.isPending) ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        editingProduct ? 'Save Changes' : 'Add Product'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
