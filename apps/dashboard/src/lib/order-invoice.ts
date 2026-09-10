import type { Order } from '@/types';

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function downloadOrderInvoice(order: Order) {
  const money = (value: number) => `${Number(value || 0).toLocaleString('en-BD', { minimumFractionDigits: 2 })} BDT`;
  const address = order.shippingAddress;
  const reference = order.invoiceNumber || order.orderNumber || order._id;
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Order invoice ${escapeHtml(reference)}</title><style>body{font:15px/1.6 system-ui,sans-serif;color:#182039;max-width:850px;margin:50px auto;padding:24px}h1{font-size:30px}table{border-collapse:collapse;width:100%;margin:30px 0}th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd}aside{margin-top:24px}small{color:#526078}@media print{body{margin:0}}</style><h1>Order invoice</h1><p>Reference: ${escapeHtml(reference)}<br>Order date: ${escapeHtml(new Date(order.createdAt).toLocaleDateString('en-GB'))}</p><p>Order status: ${escapeHtml(order.status)}<br>Payment status: ${escapeHtml(order.paymentStatus)}<br>Payment method: ${escapeHtml(order.paymentMethod)}</p><h2>Deliver to</h2><p>${[address?.fullName,address?.phone,address?.addressLine1,address?.addressLine2,address?.city,address?.zone,address?.postalCode,address?.country].filter(Boolean).map(escapeHtml).join('<br>')}</p><table><thead><tr><th>Product</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${order.items.map(item => `<tr><td>${escapeHtml(item.productName)}${item.variantName ? `<br><small>${escapeHtml(item.variantName)}</small>` : ''}</td><td>${escapeHtml(item.quantity)}</td><td>${money(item.unitPriceSnapshot)}</td><td>${money(item.subtotal)}</td></tr>`).join('')}</tbody></table><aside>Subtotal: ${money(order.subtotal)}<br>Delivery: ${money(order.deliveryFee)}<br>Discount: ${money(order.discount)}<br><strong>Total: ${money(order.total)}</strong></aside><p><small>Generated from the recorded SellPilot order. Payment status is shown as recorded; this document does not certify payment settlement or act as a tax invoice. Print this document to save a PDF.</small></p></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `sellpilot-order-${String(order._id).replace(/[^a-zA-Z0-9-]/g, '')}.html`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
