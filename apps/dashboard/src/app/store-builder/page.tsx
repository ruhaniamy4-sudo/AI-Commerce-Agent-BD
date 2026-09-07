"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Monitor, Save, Smartphone, Store } from "lucide-react";
import { businessApi, productsApi, StorefrontSettings } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SafeProductImage } from "@/components/ui/safe-product-image";
import { formatCurrency, stockLabel } from "@/lib/currency";
import { cn } from "@/lib/utils";

const defaults: StorefrontSettings = {
  primaryColor: "#6C3BFF",
  accentColor: "#D92EFF",
  heroTitle: "Shop our latest collection",
  heroSubtitle: "Products selected for quality, value, and everyday life.",
  layout: "grid",
};

export default function StoreBuilderPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["business-profile"],
    queryFn: businessApi.get,
  });
  const catalog = useQuery({ queryKey: ["store-builder-preview-products"], queryFn: () => productsApi.getAll({ page: 1, limit: 4 }) });
  const [settings, setSettings] = useState<StorefrontSettings>(defaults);
  const [preview, setPreview] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    if (data?.storefront) setSettings({ ...defaults, ...data.storefront });
  }, [data]);

  const save = useMutation({
    mutationFn: () => businessApi.updateStorefront(settings),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["business-profile"] }),
  });

  const siteUrl =
    process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3001";

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-16">
      <PageHeader
        title="Store Builder"
        description="Customize the connected storefront without changing your products, inventory, or checkout flow."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <a href={`${siteUrl}/shop`} target="_blank" rel="noreferrer">
                View live <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {save.isPending ? "Saving…" : "Publish changes"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Brand and layout</CardTitle>
            <p className="text-sm text-muted-foreground">
              Changes update the real public shop.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="space-y-2 text-sm">
              <span>Store headline</span>
              <Input
                maxLength={100}
                value={settings.heroTitle}
                onChange={(event) =>
                  setSettings({ ...settings, heroTitle: event.target.value })
                }
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Supporting message</span>
              <textarea
                maxLength={240}
                value={settings.heroSubtitle || ""}
                onChange={(event) =>
                  setSettings({ ...settings, heroSubtitle: event.target.value })
                }
                className="min-h-24 w-full rounded-md border bg-background p-3"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["primaryColor", "Primary"],
                  ["accentColor", "Accent"],
                ] as const
              ).map(([key, label]) => (
                <label className="space-y-2 text-sm" key={key}>
                  <span>{label}</span>
                  <div className="flex h-10 items-center gap-2 rounded-md border px-2">
                    <input
                      type="color"
                      value={settings[key]}
                      onChange={(event) =>
                        setSettings({ ...settings, [key]: event.target.value })
                      }
                      className="h-7 w-8 cursor-pointer border-0 bg-transparent"
                    />
                    <span className="font-mono text-xs text-muted-foreground">
                      {settings[key]}
                    </span>
                  </div>
                </label>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm">Catalog layout</p>
              <div className="grid grid-cols-2 gap-2">
                {(["grid", "editorial"] as const).map((layout) => (
                  <button
                    key={layout}
                    aria-pressed={settings.layout === layout}
                    type="button"
                    onClick={() => setSettings({ ...settings, layout })}
                    className={cn(
                      "rounded-xl border p-3 text-left text-sm font-semibold capitalize transition",
                      settings.layout === layout
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    {layout}
                  </button>
                ))}
              </div>
            </div>
            {save.isSuccess && (
              <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-600">
                Storefront settings published.
              </p>
            )}
            {save.error && (
              <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-600">
                {save.error.message}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Store preview</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Preview your design with current catalog data. Changes are not published until you save.
              </p>
            </div>
            <div className="flex rounded-xl border bg-muted/40 p-1">
              <button
                type="button"
                aria-label="Desktop preview"
                aria-pressed={preview === "desktop"}
                onClick={() => setPreview("desktop")}
                className={cn(
                  "rounded-lg p-2",
                  preview === "desktop" && "bg-background shadow-sm",
                )}
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Mobile preview"
                aria-pressed={preview === "mobile"}
                onClick={() => setPreview("mobile")}
                className={cn(
                  "rounded-lg p-2",
                  preview === "mobile" && "bg-background shadow-sm",
                )}
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="bg-muted/30 p-5 sm:p-8">
            <div
              className={cn(
                "mx-auto overflow-hidden rounded-[24px] border bg-white text-slate-950 shadow-2xl transition-all duration-300",
                preview === "mobile" ? "max-w-[390px]" : "max-w-5xl",
              )}
            >
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div className="flex items-center gap-2 font-bold">
                  <span
                    className="grid h-8 w-8 place-items-center rounded-lg text-white"
                    style={{ background: settings.primaryColor }}
                  >
                    <Store className="h-4 w-4" />
                  </span>
                  {data?.name || "Your store"}
                </div>
                <span className="text-xs text-slate-500">Catalog · Cart</span>
              </div>
              <div
                className="p-7 sm:p-10"
                style={{
                  background: `linear-gradient(135deg, ${settings.primaryColor}18, ${settings.accentColor}22)`,
                }}
              >
                <p
                  className="text-xs font-bold uppercase tracking-[.2em]"
                  style={{ color: settings.primaryColor }}
                >
                  New collection
                </p>
                <h2 className="mt-3 max-w-xl text-3xl font-black tracking-tight sm:text-5xl">
                  {settings.heroTitle || "Your storefront headline"}
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">
                  {settings.heroSubtitle}
                </p>
              </div>
              <div
                className={cn(
                  "grid gap-3 p-5",
                  preview === "mobile" || settings.layout === "editorial"
                    ? "grid-cols-2"
                    : "grid-cols-4",
                )}
              >
                {catalog.isLoading && <p className="col-span-full text-sm text-slate-500">Loading catalog…</p>}
                {catalog.isError && <p className="col-span-full text-sm text-slate-500">Catalog preview unavailable. Your saved products are unchanged.</p>}
                {catalog.data?.data.map((product) => <article className="min-w-0 rounded-xl border border-slate-200 p-3" key={product._id}>
                  <div className="aspect-square overflow-hidden rounded-lg bg-slate-50"><SafeProductImage src={product.images?.[0]} alt={product.name} imageClassName="object-contain" /></div>
                  <h3 className="mt-3 line-clamp-2 text-xs font-semibold">{product.name}</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-900">{formatCurrency(product.basePrice, product.currency)}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{stockLabel(product)}</p>
                </article>)}
                {catalog.data && !catalog.data.data.length && <p className="col-span-full py-8 text-center text-sm text-slate-500">Add your first product to see it in this preview.</p>}

              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
