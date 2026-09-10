'use client';

import {useState} from 'react';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {ArrowRight,ArrowUpRight,Package,Plus} from 'lucide-react';
import {Product} from '@/types';
import {apiClient} from '@/lib/api-client';
import {formatCurrency} from '@/lib/currency';
import {Button} from '@/components/ui/button';
import {Switch} from '@/components/ui/switch';
import {SafeProductImage} from '@/components/ui/safe-product-image';
import {WorkspacePanel,WorkspaceEmpty} from '@/components/layout/workspace-surface';
import {availableUnits,StatusLabel,useProductSelling} from './product-selling-control';
import './products.css';
import './dashboard-products.css';

type ProductOverview={topProducts:Product[];products:Product[];total:number};
const productHref=(product:Product)=>`/products?product=${encodeURIComponent(product._id)}`;

export function DashboardProductOverview() {
    const [sort,setSort]=useState('most_sales');
    const query=useQuery({
        queryKey:['products','overview',sort],
        queryFn:()=>apiClient.get<ProductOverview>('/api/products/overview',{params:{sort}}),
    });
    const selling=useProductSelling();
    const addProduct=<Button asChild><Link href="/products?new=1"><Plus size={15} className="mr-2"/>Add Product</Link></Button>;

    return <section className="dashboard-products" aria-label="Product overview">
        <div className="dashboard-products-heading">
            <div><h2>Top Products</h2><p>Your catalog’s best sellers, with inventory and AI controls in view.</p></div>
            <div className="dashboard-products-actions"><label>Sort by:<select aria-label="Sort top products" value={sort} onChange={event=>setSort(event.target.value)}><option value="most_sales">Most Sales</option><option value="newest">Recently Added</option></select></label>{addProduct}</div>
        </div>
        {query.isLoading?<div className="dashboard-top-products" aria-label="Loading top products">{[1,2,3,4].map(id=><div key={id} className="product-card h-80 bg-muted animate-pulse"/>)}</div>:
            query.isError?<div className="work-panel p-6" role="alert"><p className="text-sm text-muted-foreground">Product overview could not be loaded.</p><Button variant="outline" className="mt-3" onClick={()=>void query.refetch()}>Try again</Button></div>:
            query.data?.topProducts.length?<div className="dashboard-top-products">{query.data.topProducts.map(product=>{
                const units=availableUnits(product);
                return <article className="product-card dashboard-top-card" key={product._id}>
                    <Link href={productHref(product)} className="product-cover" aria-label={`View ${product.name}`}><SafeProductImage src={product.images?.[0]} alt={product.name} imageClassName="object-contain p-4"/><span className="product-cover-arrow"><ArrowUpRight size={15}/></span></Link>
                    <div className="product-card-body"><Link href={productHref(product)} className="product-name">{product.name}</Link><p className="product-price">{formatCurrency(product.salePrice??product.basePrice,product.currency)}</p>
                        <div className="product-inventory"><div><span>Available units</span><strong>{units==null?'Unknown':units.toLocaleString()}</strong></div><div><span>Total sold</span><strong>{(product.totalSold||0).toLocaleString()}</strong></div></div>
                        <div className="dashboard-top-status"><span>AI selling</span><StatusLabel status={product.aiSellingStatus||'active'}/></div>
                    </div>
                </article>;
            })}</div>:<WorkspacePanel><WorkspaceEmpty title="Your best sellers start here" copy="Add your first product to give your AI a catalog to sell from." action={addProduct}/></WorkspacePanel>}

        <WorkspacePanel title="Product List" description={`${query.data?.total??0} products · Manage availability and AI selling`} actions={<Button asChild variant="outline" size="sm"><Link href="/products">View All Products<ArrowRight size={14} className="ml-2"/></Link></Button>}>
            {selling.isError&&<p role="alert" className="px-5 pt-4 text-sm text-destructive">Selling status could not be updated. Check administrator access and try again.</p>}
            {query.isLoading?<p role="status" className="p-8 text-sm text-muted-foreground">Loading product list…</p>:query.isError?<p className="p-6 text-sm text-muted-foreground">Product list is unavailable while the connection is interrupted.</p>:query.data?.products.length?<div className="work-table-scroll"><table className="work-table dashboard-product-table"><thead><tr><th>Product Info</th><th>Price</th><th>Available Units</th><th>Sold</th><th>AI Status</th><th>Action</th></tr></thead><tbody>{query.data.products.map(product=>{
                const units=availableUnits(product);const status=product.aiSellingStatus||'active';
                return <tr key={product._id}><td><Link className="dashboard-product-info" href={productHref(product)}><span className="dashboard-product-thumb"><SafeProductImage src={product.images?.[0]} alt={product.name}/></span><span><strong>{product.name}</strong><small title={product._id}>ID: {product._id}</small></span></Link></td><td className="whitespace-nowrap">{formatCurrency(product.salePrice??product.basePrice,product.currency)}</td><td className={units===0?'text-rose-600':''}>{units==null?'Unknown':`${units.toLocaleString()} units`}</td><td>{(product.totalSold||0).toLocaleString()}</td><td><StatusLabel status={status}/></td><td><Switch aria-label={`AI selling for ${product.name}`} checked={status!=='disabled'} disabled={selling.isPending} onCheckedChange={checked=>selling.change(product,checked?'active':'disabled')}/></td></tr>;
            })}</tbody></table></div>:<WorkspaceEmpty title="No products yet" copy="Your products, stock counts and selling controls will appear here." action={<Button asChild variant="outline"><Link href="/products?new=1"><Package size={14} className="mr-2"/>Add a product</Link></Button>}/>}
            {!!query.data?.products.length&&<footer className="dashboard-product-footer"><span>Showing {query.data.products.length} of {query.data.total} products</span><Link href="/products">View All Products<ArrowRight size={13}/></Link></footer>}
        </WorkspacePanel>
        {selling.confirmation}
    </section>;
}
