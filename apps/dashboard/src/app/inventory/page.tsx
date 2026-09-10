"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Package } from "lucide-react";
import { productsApi } from "@/lib/api";
import { availableUnits } from "@/components/products/product-selling-control";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [alertsOnly, setAlertsOnly] = useState(false);
  const query = useQuery({ queryKey: ["products", "inventory", page, search], queryFn: () => productsApi.getAll({ page, limit: 50, search, includeInactive: "true" }) });
  const rows = (query.data?.data || []).map(product => {
    const units = availableUnits(product);
    const threshold = product.lowStockThreshold ?? 5;
    return { product, units, low: units != null && units <= threshold };
  });
  const visible = alertsOnly ? rows.filter(row => row.low || row.units == null) : rows;
  return <div className="space-y-6"><PageHeader title="Inventory" description="Review stock, low-stock alerts and recorded product sales. Open a product to update stock or inspect performance." actions={<Button asChild variant="outline"><Link href="/products">Open catalog<ArrowUpRight size={15} className="ml-2" /></Link></Button>} />
    <div className="grid gap-4 sm:grid-cols-3">{[["Products on this page", rows.length], ["Low or out of stock", rows.filter(row => row.low).length], ["Quantity unknown", rows.filter(row => row.units == null).length]].map(([label,count]) => <article key={label} className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><strong className="mt-2 block text-3xl">{query.isLoading || query.isError ? "—" : count}</strong></article>)}</div>
    <section className="work-panel"><div className="flex flex-wrap items-center justify-between gap-4 border-b p-5"><label className="w-full sm:max-w-sm"><span className="sr-only">Search inventory</span><Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search products…" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={alertsOnly} onChange={event => setAlertsOnly(event.target.checked)} />Only alerts on this page</label></div>
      {query.isLoading ? <p role="status" className="p-8">Loading inventory…</p> : query.isError ? <div role="alert" className="p-8"><p>Inventory could not be loaded.</p><Button variant="outline" className="mt-3" onClick={() => query.refetch()}>Retry</Button></div> : <div className="work-table-scroll"><table className="work-table"><thead><tr><th>Product</th><th>Available units</th><th>Alert threshold</th><th>Units sold</th><th>Stock status</th><th>Details</th></tr></thead><tbody>{visible.map(({product,units,low}) => <tr key={product._id}><td><strong>{product.name}</strong><small>{product.variants?.filter(variant => variant.isActive !== false).length || 0} active variants{!product.isActive ? " · Hidden from store" : ""}</small></td><td>{units == null ? "Unknown" : units.toLocaleString()}</td><td>{product.lowStockThreshold ?? 5}</td><td>{(product.totalSold || 0).toLocaleString()}</td><td><span className={`work-status ${low ? "text-amber-600" : ""}`}>{units == null ? "Confirm quantity" : units === 0 ? "Out of stock" : low ? "Low stock" : "In stock"}</span></td><td><Link className="text-primary underline" href={`/products?product=${encodeURIComponent(product._id)}`}>View product</Link></td></tr>)}</tbody></table>{!visible.length && <div className="work-empty"><Package /><h2>No matching products</h2><p>Adjust your search or alerts filter, or review another page.</p></div>}</div>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t p-5 text-sm"><p>Page {page} of {Math.max(1, query.data?.pagination.totalPages || 1)} · {query.data?.pagination.total ?? "—"} matching products</p><div className="flex gap-2"><Button variant="outline" disabled={page <= 1 || query.isLoading} onClick={() => setPage(value => value - 1)}>Previous</Button><Button variant="outline" disabled={query.isLoading || page >= (query.data?.pagination.totalPages || 1)} onClick={() => setPage(value => value + 1)}>Next</Button></div></footer>
    </section><p className="text-xs leading-6 text-muted-foreground">Available units include active variants. Unknown quantities stay unknown. Summary counts and alerts apply to the current page; units sold come from recorded product sales.</p>
  </div>;
}
