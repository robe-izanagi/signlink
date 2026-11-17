export function formatMoney(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatWholePeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    maximumFractionDigits: 0,
  })}`;
}
