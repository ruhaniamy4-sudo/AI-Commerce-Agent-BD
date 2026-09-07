'use client';

import {WorkspaceSearch,WorkspacePagination} from '@/components/layout/workspace-surface';
import {ProductWorkspace} from '@/components/products/product-workspace';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { productsApi, categoriesApi } from '@/lib/api';
import { Product, ProductVariant } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Loader2,
    SlidersHorizontal,
    Plus,
    Trash2,

    Layers,
    ListChecks,
} from 'lucide-react';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';


export default function ProductsPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [page,setPage] = useState(1);
    const limit = 12;
    const [filtersOpen,setFiltersOpen]=useState(false);
    const [statusFilter,setStatusFilter]=useState('');
    const [categoryFilter,setCategoryFilter]=useState('');

    // Dialog States
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [activeTab, setActiveTab] = useState('general');

    const { data: response, isLoading, isError } = useQuery({
        queryKey: ['products', page, searchQuery,statusFilter,categoryFilter],
        queryFn: () => productsApi.getAll({ page, limit, search: searchQuery,aiSellingStatus:statusFilter,categoryId:categoryFilter,includeInactive:'true' }),
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
        currency: 'BDT',
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
            currency: formData.currency || 'BDT',
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
            currency: 'BDT',
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
            currency: product.currency || 'BDT',
            stock: product.stock,
            images: product.images || [],
            categoryId: typeof product.categoryId==='object'?(product.categoryId as unknown as {_id:string})._id:product.categoryId,
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

return (<div><PageHeader title="Products" description="Manage your products, inventory and control what your AI agent can sell." actions={<><WorkspaceSearch value={searchQuery} onChange={v=>{setSearchQuery(v);setPage(1);}} placeholder="Search products"/><Button variant="outline" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={15} className="mr-2"/>Filter</Button><Button onClick={()=>{resetForm();setIsDialogOpen(true);}}><Plus size={15} className="mr-2"/>Add Product</Button></>}/>
{filtersOpen&&<div className="product-filters"><select aria-label="Filter by AI selling status" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1);}}><option value="">All selling states</option><option value="active">Active</option><option value="limited">Limited</option><option value="disabled">Disabled</option></select><select aria-label="Filter by category" value={categoryFilter} onChange={e=>{setCategoryFilter(e.target.value);setPage(1);}}><option value="">All categories</option>{categories?.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}</select><Button variant="ghost" onClick={()=>{setStatusFilter('');setCategoryFilter('');setPage(1);}}>Reset filters</Button><Button asChild variant="ghost"><Link href="/categories"><Layers size={14} className="mr-2"/>Manage Categories</Link></Button></div>}
<div className="flex justify-between mb-4 text-xs text-muted-foreground"><span>{pagination?.total||0} products in your catalog</span><span>Inventory & AI selling control</span></div><ProductWorkspace products={products} loading={isLoading} error={isError} onAdd={()=>{resetForm();setIsDialogOpen(true);}} onEdit={openEdit} onDelete={id=>deleteMutation.mutate(id)}/><WorkspacePagination page={page} totalPages={pagination?.totalPages||1} onChange={setPage}/>
<Dialog open={isDialogOpen} onOpenChange={(open) => {setIsDialogOpen(open);if(!open)resetForm();}}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden border-border shadow-2xl rounded-xl bg-background text-foreground">
                    <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
                        <DialogHeader className="p-6 bg-muted/5 border-b border-border">
                            <div className="flex items-center justify-between">
                                <div>
                                    <DialogTitle className="text-2xl font-semibold text-foreground tracking-tight">
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
                                <TabsList className="h-12 bg-transparent gap-6 p-0">
                                    <TabsTrigger value="general" className="relative h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-bold px-0 transition-all text-sm tracking-normal">
                                        General Info
                                    </TabsTrigger>
                                    <TabsTrigger value="variants" className="relative h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-bold px-0 transition-all text-sm tracking-normal">
                                        Variants
                                    </TabsTrigger>
                                    <TabsTrigger value="specs" className="relative h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-bold px-0 transition-all text-sm tracking-normal">
                                        Specifications
                                    </TabsTrigger>
                                    <TabsTrigger value="settings" className="relative h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-bold px-0 transition-all text-sm tracking-normal">
                                        Settings
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                                <TabsContent value="general" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Product Name</Label>
                                                <Input
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    required
                                                    className="h-11 bg-muted/30 border-border focus:bg-muted/50 rounded-2xl  transition-all text-foreground placeholder:text-muted-foreground/60 px-6 font-medium"
                                                    placeholder="e.g. Wireless Gaming Headset"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Category</Label>
                                                <Select
                                                    value={formData.categoryId}
                                                    onValueChange={val => setFormData({ ...formData, categoryId: val })}
                                                >
                                                    <SelectTrigger className="h-11 bg-white/[0.03] border-white/10 rounded-2xl focus:bg-white/[0.06] transition-all px-6">
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
                                                className="h-[156px] bg-muted/30 border-border focus:bg-muted/50 rounded-2xl  p-6 transition-all resize-none text-foreground placeholder:text-muted-foreground/60 leading-relaxed font-medium"
                                                placeholder="Enter a detailed description of the product..."
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Product Images</Label>
                                        <div className="bg-white/[0.02] border border-white/5 p-6 rounded-xl">
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
                                            <h4 className="text-xl font-bold text-foreground tracking-tight">Product Variants</h4>
                                            <p className="text-sm text-muted-foreground mt-1">Manage multiple versions for size, color, or bundle variations.</p>
                                        </div>
                                        <Button type="button" onClick={addVariant} variant="outline" className="h-12 rounded-2xl border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-muted-foreground hover:text-primary transition-all px-6 font-bold text-xs tracking-normal">
                                            <Plus className="h-4 w-4 mr-2" /> Add Variant
                                        </Button>
                                    </div>

                                    {formData.variants && formData.variants.length > 0 ? (
                                        <div className="space-y-4">
                                            {formData.variants.map((variant, index) => (
                                                <div key={variant.variantId} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden group hover:bg-white/[0.03] transition-colors p-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                                                        <div className="md:col-span-4 space-y-2">
                                                            <Label className="text-[10px] font-black tracking-normal text-muted-foreground ml-1">Identifier</Label>
                                                            <Input
                                                                value={variant.name}
                                                                onChange={e => updateVariant(index, { name: e.target.value })}
                                                                className="h-11 bg-white/5 border-white/10 rounded-xl text-sm"
                                                                placeholder="e.g. Midnight Black / XL"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-2 space-y-2">
                                                            <Label className="text-[10px] font-black tracking-normal text-muted-foreground ml-1">Price</Label>
                                                            <Input
                                                                type="number"
                                                                value={variant.price}
                                                                onChange={e => updateVariant(index, { price: Number(e.target.value) })}
                                                                className="h-11 bg-white/5 border-white/10 rounded-xl text-sm"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-2 space-y-2">
                                                            <Label className="text-[10px] font-black tracking-normal text-muted-foreground ml-1">Stock</Label>
                                                            <Input
                                                                type="number"
                                                                value={variant.stock ?? ''}
                                                                onChange={e => updateVariant(index, { stock: Number(e.target.value) })}
                                                                className="h-11 bg-white/5 border-white/10 rounded-xl text-sm"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-3 space-y-2">
                                                            <Label className="text-[10px] font-black tracking-normal text-muted-foreground ml-1">SKU</Label>
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
                                        <div className="p-20 text-center bg-white/[0.01] rounded-xl border border-dashed border-white/5">
                                            <Layers className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                                            <p className="text-muted-foreground font-bold tracking-tight">No product variants defined. Base parameters will apply.</p>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="specs" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-xl font-bold text-foreground tracking-tight">Technical Specs</h4>
                                            <p className="text-sm text-muted-foreground mt-1">Add details like weight, dimensions, or material.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-6 bg-white/[0.02] rounded-2xl border border-white/5">
                                        <div className="md:col-span-5 space-y-2">
                                            <Label className="text-[10px] font-black tracking-normal text-muted-foreground ml-1">Spec Name</Label>
                                            <Input value={specKey} onChange={e => setSpecKey(e.target.value)} placeholder="e.g. Color" className="h-12 bg-white/5 border-white/10 rounded-xl" />
                                        </div>
                                        <div className="md:col-span-5 space-y-2">
                                            <Label className="text-[10px] font-black tracking-normal text-muted-foreground ml-1">Spec Value</Label>
                                            <Input value={specValue} onChange={e => setSpecValue(e.target.value)} placeholder="e.g. Blue" className="h-12 bg-white/5 border-white/10 rounded-xl" />
                                        </div>
                                        <div className="md:col-span-2 pt-6">
                                            <Button type="button" onClick={addSpec} className="w-full h-12 rounded-xl bg-primary text-white font-black text-xs tracking-normal hover:bg-violet-600 transition-all shadow-lg shadow-primary/20">Add</Button>
                                        </div>
                                    </div>

                                    {Object.keys(formData.specs || {}).length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {Object.entries(formData.specs || {}).map(([key, value]) => (
                                                <div key={key} className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-primary/30 transition-all">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em] mb-1">{key}</span>
                                                        <span className="text-foreground font-bold tracking-tight">{value as string}</span>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSpec(key)} className="opacity-0 group-hover:opacity-100 transition-opacity h-10 w-10 text-muted-foreground/30 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl">
                                                        <Trash2 className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-20 text-center bg-white/[0.01] rounded-xl border border-dashed border-white/5">
                                            <ListChecks className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                                            <p className="font-bold tracking-tight text-muted-foreground">No technical specifications have been added yet.</p>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="settings" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                        <div className="space-y-8">
                                            <div className="space-y-6">
                                                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 border-l-2 border-primary pl-4">Pricing & Stock</h5>
                                                <div className="grid gap-6 sm:grid-cols-3">
                                                    <div className="space-y-3">
                                                        <Label className="text-[10px] font-black tracking-normal text-muted-foreground ml-1">Base Price</Label>
                                                        <Input type="number" value={formData.basePrice} onChange={e => setFormData({ ...formData, basePrice: Number(e.target.value) })} className="h-11 bg-white/[0.03] border-white/10 rounded-2xl" />
                                                    </div>
                                                    <div className="space-y-3">
                                                        <Label className="text-[10px] font-black tracking-normal text-muted-foreground ml-1">Currency</Label>
                                                        <Select value={formData.currency || 'BDT'} onValueChange={currency => setFormData({ ...formData, currency })}><SelectTrigger className="h-11 rounded-2xl"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="BDT">BDT (৳)</SelectItem><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem><SelectItem value="GBP">GBP (£)</SelectItem><SelectItem value="INR">INR (₹)</SelectItem></SelectContent></Select>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <Label className="text-[10px] font-black tracking-normal text-muted-foreground ml-1">Total Stock</Label>
                                                        <Input type="number" value={formData.stock ?? ''} onChange={e => setFormData({ ...formData, stock: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Leave blank if unknown" className="h-11 bg-white/[0.03] border-white/10 rounded-2xl" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 border-l-2 border-primary pl-4">Alerts</h5>
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black tracking-normal text-muted-foreground ml-1">Low Stock Threshold</Label>
                                                    <Input type="number" value={formData.lowStockThreshold} onChange={e => setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })} className="h-11 bg-white/[0.03] border-white/10 rounded-2xl" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 border-l-2 border-rose-500 pl-4">Display Settings</h5>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between p-5 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/[0.04] transition-colors">
                                                    <div>
                                                        <p className="text-sm font-bold text-foreground tracking-tight">Show in Store</p>
                                                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">Make this product visible to customers</p>
                                                    </div>
                                                    <Switch checked={formData.isActive} onCheckedChange={checked => setFormData({ ...formData, isActive: checked })} />
                                                </div>

                                                <div className="flex items-center justify-between p-5 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/[0.04] transition-colors">
                                                    <div>
                                                        <p className="text-sm font-bold text-foreground tracking-tight">Featured Product</p>
                                                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">Highlight this product in your store</p>
                                                    </div>
                                                    <Switch checked={formData.isFeatured} onCheckedChange={checked => setFormData({ ...formData, isFeatured: checked })} />
                                                </div>

                                                <div className="flex items-center justify-between p-5 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/[0.04] transition-colors">
                                                    <div>
                                                        <p className="text-sm font-bold text-foreground tracking-tight">Returns Allowed</p>
                                                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">Allow customers to return this product</p>
                                                    </div>
                                                    <Switch checked={formData.isReturnable} onCheckedChange={checked => setFormData({ ...formData, isReturnable: checked })} />
                                                </div>

                                                <div className="space-y-3 pt-4">
                                                    <Label className="text-[10px] font-black tracking-normal text-muted-foreground ml-1">Warranty (Months)</Label>
                                                    <Input type="number" value={formData.warrantyMonths} onChange={e => setFormData({ ...formData, warrantyMonths: Number(e.target.value) })} className="h-11 bg-white/[0.03] border-white/10 rounded-2xl" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>

                        {(createMutation.isError||updateMutation.isError)&&<p role="alert" className="px-6 text-sm text-destructive">Could not save product. Check required fields, category and administrator access.</p>}<div className="p-6 bg-muted/20 border-t border-border flex justify-between items-center">
                            <Button type="button" variant="ghost" onClick={resetForm} className="text-muted-foreground/50 hover:text-foreground font-black uppercase text-[10px] tracking-[0.2em] transition-colors">Clear Form</Button>
                            <div className="flex gap-4">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="h-11 rounded-2xl border-border bg-transparent text-foreground px-8 font-bold hover:bg-accent">Cancel</Button>
                                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="h-11 bg-primary text-primary-foreground rounded-2xl px-12 font-black tracking-normal shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
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
