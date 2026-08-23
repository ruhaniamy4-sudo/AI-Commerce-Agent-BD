const baseUrl = process.env.AGENT_BASE_URL || 'http://localhost:4000';
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${text}`);
  return body;
}

const health = await api('/health');
assert(health.mongo === 'connected', 'MongoDB is not connected');

const category = await api('/api/categories', {
  method: 'POST',
  body: JSON.stringify({
    name: `Baseline ${runId}`,
    slug: `baseline-${runId}`,
    description: 'Milestone 1 smoke category',
  }),
});

const product = await api('/api/products', {
  method: 'POST',
  body: JSON.stringify({
    name: `Baseline Product ${runId}`,
    slug: `baseline-product-${runId}`,
    description: 'Milestone 1 smoke product',
    categoryId: category._id,
    basePrice: 500,
    stock: 5,
    variants: [],
    images: [],
  }),
});

const customer = await api('/api/customers', {
  method: 'POST',
  body: JSON.stringify({
    psid: `smoke-${runId}`,
    name: 'Baseline Smoke Customer',
    phone: '01700000000',
  }),
});

const order = await api('/api/orders/manual', {
  method: 'POST',
  body: JSON.stringify({
    customerId: customer._id,
    items: [{ productId: product._id, quantity: 2 }],
    deliveryFee: 60,
    paymentMethod: 'Cash on Delivery',
    shippingAddress: {
      fullName: 'Baseline Smoke Customer',
      phone: '01700000000',
      addressLine1: 'Smoke test address',
      city: 'Dhaka',
      zone: 'Dhaka North',
      country: 'Bangladesh',
    },
  }),
});

assert(order.orderNumber, 'Order number was not generated');
assert(order.items?.[0]?.productName === product.name, 'Order item was not normalized');
assert(order.items?.[0]?.subtotal === 1000, 'Order item subtotal is incorrect');
assert(order.total === 1060, 'Order total is incorrect');

const fetchedOrder = await api(`/api/orders/${order.orderNumber}`);
assert(fetchedOrder._id === order._id, 'Order lookup by order number failed');

const productAfterSuccess = await api(`/api/products/${product._id}`);
assert(productAfterSuccess.stock === 3, 'Successful order did not reduce stock exactly once');

const failedResponse = await fetch(`${baseUrl}/api/orders/manual`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    customerId: customer._id,
    items: [{ productId: product._id, quantity: 99 }],
    shippingAddress: {
      fullName: 'Baseline Smoke Customer',
      phone: '01700000000',
      addressLine1: 'Smoke test address',
      city: 'Dhaka',
      zone: 'Dhaka North',
      country: 'Bangladesh',
    },
  }),
});
assert(failedResponse.status === 400, `Expected failed order to return 400, got ${failedResponse.status}`);

const productAfterFailure = await api(`/api/products/${product._id}`);
assert(productAfterFailure.stock === 3, 'Failed order changed stock');

console.log(`Baseline smoke passed: ${order.orderNumber}`);
