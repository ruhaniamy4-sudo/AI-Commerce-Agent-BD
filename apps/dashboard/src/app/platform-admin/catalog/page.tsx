'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {Boxes} from 'lucide-react';
import {platformApi} from '@/lib/platform-api';
import {PageHeading,Pager,Panel,StatCard,Status,TabBar,Toolbar,dateOnly,dateTime,money} from '@/components/platform/platform-ui';

type Tab='overview'|'orders'|'products';
const TABS:Array<[Tab,string]>=[['overview','Overview'],['orders','Orders'],['products','Products']];
const ORDER_STATUSES=['pending','confirmed','packed','shipped','delivered','completed','cancelled','returned'];

/**
 * Commerce across every tenant, read-only. Support needs to answer "is this order
 * real" without signing in as the merchant, and operations needs to see which
 * workspaces carry the load — neither of which should be a reason to grant writes.
 */
export default function Catalog(){
 const [tab,setTab]=useState<Tab>('overview');
 const [search,setSearch]=useState('');
 const [status,setStatus]=useState('');
 const [page,setPage]=useState(1);
 const overview=useQuery({queryKey:['platform-catalog'],queryFn:platformApi.catalog,enabled:tab==='overview'});
 const orders=useQuery({queryKey:['platform-catalog-orders',search,status,page],queryFn:()=>platformApi.catalogOrders(search,status,page),enabled:tab==='orders'});
 const products=useQuery({queryKey:['platform-catalog-products',search,page],queryFn:()=>platformApi.catalogProducts(search,page),enabled:tab==='products'});
 const totals=overview.data?.totals;

 return <div>
  <PageHeading eyebrow="Merchants" title="Catalog oversight" copy="Products, orders, and conversations across every workspace — visible to operations, editable only by the merchant." actions={<Status tone="info">Read-only</Status>}/>
  <TabBar tabs={TABS} active={tab} onChange={next=>{setTab(next);setPage(1)}}/>

  {tab==='overview'&&<>
   <div className="platform-metrics">
    <StatCard label="Products" value={totals?.products||0} detail="Across all workspaces" tone="violet"/>
    <StatCard label="Orders" value={totals?.orders||0} detail="Every recorded order" tone="blue"/>
    <StatCard label="Conversations" value={totals?.conversations||0} detail={`${(totals?.messages||0).toLocaleString()} messages`} tone="green"/>
    <StatCard label="Customers" value={totals?.customers||0} detail={`${(totals?.knowledge||0).toLocaleString()} knowledge entries`} tone="amber"/>
   </div>
   <div className="platform-grid equal">
    <Panel title="Largest catalogs" copy="Workspaces by product count">
     <div className="platform-kv">{(overview.data?.topProducts||[]).map(row=><div key={row._id}><dt>{row.name||'Deleted workspace'}</dt><dd>{row.count.toLocaleString()}</dd></div>)}</div>
     {!overview.isLoading&&!overview.data?.topProducts.length&&<div className="platform-empty"><Boxes size={20}/>No products recorded.</div>}
    </Panel>
    <Panel title="Highest order value" copy="Workspaces by total recorded order value">
     <div className="platform-kv">{(overview.data?.topOrders||[]).map(row=><div key={row._id}><dt>{row.name||'Deleted workspace'}</dt><dd>{money(row.value)} · {row.count.toLocaleString()} orders</dd></div>)}</div>
    </Panel>
   </div>
   <Panel title="Busiest inboxes" copy="Workspaces by conversation count" className="mt-4">
    <div className="platform-kv">{(overview.data?.topConversations||[]).map(row=><div key={row._id}><dt>{row.name||'Deleted workspace'}</dt><dd>{row.count.toLocaleString()}</dd></div>)}</div>
   </Panel>
  </>}

  {tab==='orders'&&<Panel title="Orders" copy="Search by order number, customer name, or phone" action={<Toolbar>
   <input className="platform-control" placeholder="Order, customer, phone" value={search} onChange={event=>{setSearch(event.target.value);setPage(1)}}/>
   <select className="platform-control" value={status} onChange={event=>{setStatus(event.target.value);setPage(1)}}><option value="">All statuses</option>{ORDER_STATUSES.map(value=><option key={value}>{value}</option>)}</select>
  </Toolbar>}>
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Order</th><th>Workspace</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Payment</th><th>Placed</th></tr></thead><tbody>
    {orders.data?.data.map(order=><tr key={order._id}>
     <td><strong>{order.orderNumber}</strong></td>
     <td><Link href={`/platform-admin/businesses/${order.businessId}`}>{order.businessName||'Deleted workspace'}</Link></td>
     <td>{order.customerName||'—'}</td>
     <td>{order.itemCount}</td>
     <td><strong>{money(order.total)}</strong></td>
     <td><Status tone={['delivered','completed'].includes(order.status)?'success':['cancelled','returned'].includes(order.status)?'danger':'info'}>{order.status}</Status></td>
     <td>{order.paymentStatus}</td>
     <td>{dateTime(order.createdAt)}</td>
    </tr>)}
   </tbody></table>
   {!orders.isLoading&&!orders.data?.data.length&&<div className="platform-empty">No orders match this view.</div>}</div>
   {orders.data&&<Pager page={orders.data.pagination.page} totalPages={orders.data.pagination.totalPages} total={orders.data.pagination.total} onPage={setPage}/>}
  </Panel>}

  {tab==='products'&&<Panel title="Products" copy="Search by name or SKU" action={<Toolbar>
   <input className="platform-control" placeholder="Product or SKU" value={search} onChange={event=>{setSearch(event.target.value);setPage(1)}}/>
  </Toolbar>}>
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Product</th><th>Workspace</th><th>SKU</th><th>Price</th><th>Stock</th><th>State</th><th>Updated</th></tr></thead><tbody>
    {products.data?.data.map(product=><tr key={product._id}>
     <td><strong>{product.name}</strong></td>
     <td><Link href={`/platform-admin/businesses/${product.businessId}`}>{product.businessName||'Deleted workspace'}</Link></td>
     <td>{product.sku||'—'}</td>
     <td>{money(product.price)}</td>
     <td>{product.stock??'—'}</td>
     <td><Status tone={product.isActive?'success':'neutral'}>{product.isActive?'Active':'Hidden'}</Status></td>
     <td>{dateOnly(product.updatedAt)}</td>
    </tr>)}
   </tbody></table>
   {!products.isLoading&&!products.data?.data.length&&<div className="platform-empty">No products match this view.</div>}</div>
   {products.data&&<Pager page={products.data.pagination.page} totalPages={products.data.pagination.totalPages} total={products.data.pagination.total} onPage={setPage}/>}
  </Panel>}
 </div>;
}
