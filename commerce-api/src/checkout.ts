export interface CheckoutItem { id: number; quantity: number }

export function validateCheckout(body: any) {
  const { items, customer, couponCode, codVerificationToken } = body || {};
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new Error('Checkout requires between 1 and 100 cart items');
  }
  const quantities = new Map<number, number>();
  for (const item of items) {
    if (!Number.isSafeInteger(item?.id) || item.id <= 0 || item.id > 2147483647 ||
        !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || item.quantity > 10000) {
      throw new Error('Product IDs and quantities must be positive integers');
    }
    const quantity = (quantities.get(item.id) || 0) + item.quantity;
    if (quantity > 10000) throw new Error('Quantity exceeds the checkout limit');
    quantities.set(item.id, quantity);
  }
  const fields = ['email', 'fullName', 'phone', 'fullAddress', 'district'] as const;
  for (const field of fields) {
    if (typeof customer?.[field] !== 'string' || !customer[field].trim()) {
      throw new Error(`Customer ${field} is required`);
    }
  }
  const email = customer.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email is required');
  const paymentMethod = customer.paymentMethod || 'cod';
  if (!['cod', 'bkash'].includes(paymentMethod)) throw new Error('Unsupported payment method');
  if (paymentMethod === 'cod' && (typeof codVerificationToken !== 'string' || !/^[a-f0-9]{64}$/.test(codVerificationToken))) {
    throw new Error('Verify your email before placing a COD order');
  }
  if (couponCode != null && typeof couponCode !== 'string') throw new Error('Invalid coupon code');
  return {
    items: [...quantities].sort(([a], [b]) => a - b).map(([id, quantity]) => ({ id, quantity })),
    customer: { ...customer, email, paymentMethod },
    couponCode: couponCode?.trim().toUpperCase(),
    codVerificationToken,
  };
}

export function shippingCostFor(district: string): number {
  const inside = ['dhaka', 'dhaka city'].includes(district.trim().toLowerCase());
  const cost = Number(inside
    ? process.env.FALLBACK_SHIPPING_RATE_DHAKA || 60
    : process.env.FALLBACK_SHIPPING_RATE_OUTSIDE || 120);
  if (!Number.isFinite(cost) || cost < 0) throw new Error('Invalid shipping configuration');
  return Math.round(cost * 100) / 100;
}

export function confirmationError(tx: any, method: 'cod' | 'bkash'): string | null {
  if (tx.customer_info?.paymentMethod !== method) return 'Payment method does not match this checkout';
  const confirmedStatus = method === 'cod' ? 'COD_CONFIRMED' : 'PENDING_BKASH_VERIFICATION';
  if (tx.status === confirmedStatus) return null;
  if (tx.status !== 'PENDING') return 'This checkout has already been cancelled or processed';
  if (!tx.expires_at || new Date(tx.expires_at).getTime() <= Date.now()) return 'Checkout expired. Please start again';
  return null;
}
