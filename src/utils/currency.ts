export function formatCurrency(amount: number, currency?: string | null): string | null {
  if (!Number.isFinite(amount)) return null;
  const code = typeof currency === 'string' && currency.trim().length === 3
    ? currency.trim().toUpperCase()
    : 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

