"use client";

import { useCart } from "@/context/cart-context";
import {
  CheckoutResult,
  getStoreSettings,
  StoreSettings,
  submitCheckout,
} from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {trackCustomer} from '@/lib/tracking';

interface CustomerData {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  zone: string;
  paymentMethod: string;
  customerNote: string;
}

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, clearCart, total } = useCart();
  const [step, setStep] = useState<"cart" | "checkout" | "complete">("cart");
  useEffect(()=>{if(step==='checkout')void trackCustomer('checkout_started');},[step]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [form, setForm] = useState<CustomerData>({
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "Dhaka",
    zone: "",
    paymentMethod: "Cash on Delivery",
    customerNote: "",
  });
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getStoreSettings()
      .then((value) => {
        setSettings(value);
        setForm((current) => ({
          ...current,
          paymentMethod: value.paymentMethods[0] || "Cash on Delivery",
        }));
      })
      .catch(() => undefined);
  }, []);
  const deliveryFee = useMemo(
    () =>
      /dhaka|ঢাকা/i.test(form.city)
        ? (settings?.deliveryFees.insideDhaka ?? 80)
        : (settings?.deliveryFees.outsideDhaka ?? 130),
    [form.city, settings],
  );

  async function placeOrder(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const order = await submitCheckout(
        {
          customer: { fullName: form.fullName, phone: form.phone },
          shippingAddress: {
            addressLine1: form.addressLine1,
            ...(form.addressLine2 ? { addressLine2: form.addressLine2 } : {}),
            city: form.city,
            ...(form.zone ? { zone: form.zone } : {}),
          },
          paymentMethod: form.paymentMethod,
          customerNote: form.customerNote,
          items: items.map((item) => ({
            productId: String(item._id),
            quantity: item.quantity,
          })),
        },
        crypto.randomUUID(),
      );
      setResult(order);
      clearCart();
      setStep("complete");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not place the order",
      );
    } finally {
      setBusy(false);
    }
  }

if(step==="complete"&&result)return <main className="sp-dark sp-section min-h-[70vh]"><section className="sp-wrap max-w-3xl"><span className="sp-icon"><CheckCircle2/></span><p className="sp-eyebrow mt-8">Order confirmed</p><h1 className="text-4xl mt-5">Thank you. We have your order.</h1><p className="sp-copy mt-5">Your order has been saved. The merchant can now process it.</p><dl className="sp-glass p-7 mt-8 grid gap-6 sm:grid-cols-2">{[["Order number",result.orderNumber],["Total","৳"+result.total.toLocaleString()],["Payment",result.paymentMethod],["Status",result.status]].map(([label,value])=><div key={label}><dt className="sp-note">{label}</dt><dd className="text-base mt-2 capitalize">{value}</dd></div>)}</dl><Link className="sp-button sp-button-primary mt-8" href="/shop">Continue shopping</Link></section></main>;
return <main className="sp-light sp-section min-h-[75vh]"><div className="sp-wrap"><header className="flex flex-wrap items-end justify-between gap-6 mb-10"><div><p className="sp-eyebrow">Your order</p><h1 className="text-4xl mt-4">{step==="cart"?"A few good choices.":"Where should we send it?"}</h1><p className="sp-copy !text-sm mt-4">Review your items, delivery details, and payment before confirming.</p></div><Link href="/shop" className="text-xs text-[#7954bd] flex gap-2 items-center"><ArrowLeft size={14}/>Continue shopping</Link></header><ol className="flex items-center gap-8 mb-8 text-xs text-[#9290a4]"><li className={step==="cart"?"text-[#7852bd]":""}>01 · Your bag</li><li className={step==="checkout"?"text-[#7852bd]":""}>02 · Delivery & payment</li><li>03 · Confirmation</li></ol>{!items.length?<div className="sp-surface py-16 text-center px-5"><ShoppingBag className="mx-auto text-[#a79abe]" size={35}/><h2 className="text-2xl mt-6">Your bag is waiting.</h2><p className="sp-copy mx-auto !text-sm mt-3">Find something you love in the collection.</p><Link className="sp-button sp-button-primary mt-6" href="/shop">Explore products</Link></div>:<div className="grid gap-8 lg:grid-cols-[1.5fr_.8fr]"><section>{step==="cart"?<div className="sp-surface divide-y divide-[#e5e1ec]">{items.map(item=><article key={String(item._id)} className="p-5 sm:p-7 flex flex-wrap items-center gap-5"><div className="relative w-20 h-24 rounded-lg bg-[#eeebf2] overflow-hidden shrink-0">{item.images[0]?<Image src={item.images[0]} alt={item.name} fill className="object-contain"/>:<ShoppingBag className="m-auto mt-8 text-[#a294b8]"/>}</div><div className="flex-1 min-w-[120px]"><h2 className="text-base">{item.name}</h2><p className="text-xs text-[#818096] mt-2">৳{item.basePrice.toLocaleString()} each</p><div className="inline-flex items-center border rounded-lg mt-4"><button className="p-2" aria-label={`Decrease ${item.name} quantity`} onClick={()=>updateQuantity(String(item._id),-1)}><Minus size={13}/></button><span className="text-xs w-7 text-center">{item.quantity}</span><button className="p-2" aria-label={`Increase ${item.name} quantity`} onClick={()=>updateQuantity(String(item._id),1)}><Plus size={13}/></button></div></div><div className="text-right"><strong className="text-sm">৳{(item.quantity*item.basePrice).toLocaleString()}</strong><button className="block ml-auto mt-4 text-[#a28d9b] p-2" aria-label={`Remove ${item.name}`} onClick={()=>removeFromCart(String(item._id))}><Trash2 size={15}/></button></div></article>)}</div>:                <form
                  id="checkout-form"
                  onSubmit={placeOrder}
                  className="sp-surface grid gap-5 p-6 sm:grid-cols-2 sm:p-8"
                >
                  {error && (
                    <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">
                      {error}
                    </p>
                  )}
                  <Field label="Full name">
                    <input
                      required
                      minLength={2}
                      autoComplete="name"
                      value={form.fullName}
                      onChange={(e) =>
                        setForm({ ...form, fullName: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Bangladesh mobile number">
                    <input
                      required
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="01XXXXXXXXX"
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Address" className="sm:col-span-2">
                    <input
                      required
                      minLength={5}
                      autoComplete="street-address"
                      value={form.addressLine1}
                      onChange={(e) =>
                        setForm({ ...form, addressLine1: e.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label="Apartment or landmark"
                    className="sm:col-span-2"
                  >
                    <input
                      value={form.addressLine2}
                      onChange={(e) =>
                        setForm({ ...form, addressLine2: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="City">
                    <input
                      required
                      minLength={2}
                      autoComplete="address-level2"
                      value={form.city}
                      onChange={(e) =>
                        setForm({ ...form, city: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Area / zone">
                    <input
                      autoComplete="address-level3"
                      value={form.zone}
                      onChange={(e) =>
                        setForm({ ...form, zone: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Payment method" className="sm:col-span-2">
                    <select
                      value={form.paymentMethod}
                      onChange={(e) =>
                        setForm({ ...form, paymentMethod: e.target.value })
                      }
                    >
                      {(settings?.paymentMethods || ["Cash on Delivery"]).map(
                        (method) => (
                          <option key={method}>{method}</option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field
                    label="Order note (optional)"
                    className="sm:col-span-2"
                  >
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={form.customerNote}
                      onChange={(e) =>
                        setForm({ ...form, customerNote: e.target.value })
                      }
                    />
                  </Field>
                </form>}</section><aside><div className="sp-dark rounded-2xl p-7 sticky top-28"><p className="sp-eyebrow">The details</p><h2 className="text-2xl mt-5">Order summary</h2><dl className="space-y-4 mt-8 text-sm">{[["Subtotal",total],["Delivery estimate",deliveryFee],["Total",total+deliveryFee]].map(([label,value])=><div key={label} className="flex justify-between gap-4"><dt className="text-[#a6a5bc]">{label}</dt><dd>৳{Number(value).toLocaleString()}</dd></div>)}</dl><p className="sp-note mt-6 pt-5 border-t border-white/10 flex gap-2"><ShieldCheck size={16}/>Stock and final prices are checked when you confirm.</p>{step==="cart"?<button className="sp-button sp-button-primary w-full mt-7" onClick={()=>setStep("checkout")}>Continue to delivery</button>:<><button className="sp-button sp-button-primary w-full mt-7" form="checkout-form" type="submit" disabled={busy||settings?.storeEnabled===false}>{busy?"Confirming…":"Confirm order"}</button><button className="sp-button sp-button-secondary w-full mt-3" onClick={()=>setStep("cart")} disabled={busy}>Back to your bag</button></>}<p className="sp-note mt-5 flex gap-2"><Truck size={15}/>{settings?.deliveryPolicy||"Delivery charges depend on your location."}</p></div></aside></div>}</div></main>;
}
function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`space-y-2 text-sm font-semibold text-[var(--ink)] ${className}`}
    >
      <span>{label}</span>
      <div className="[&_input]:h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-[var(--line)] [&_input]:bg-[var(--surface)] [&_input]:px-4 [&_select]:h-12 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-[var(--line)] [&_select]:bg-[var(--surface)] [&_select]:px-4 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-[var(--line)] [&_textarea]:bg-[var(--surface)] [&_textarea]:p-4">
        {children}
      </div>
    </label>
  );
}
