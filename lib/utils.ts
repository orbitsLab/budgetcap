import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an integer paise value as Indian Rupees.
 * e.g. 125000 paise → ₹1,250.00
 * e.g. 100000000 paise → ₹10,00,000.00  (en-IN grouping)
 */
export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Parse a Rupee string entered by the user (e.g. "1250.50") into paise.
 * Returns 0 if the input is invalid.
 */
export function rupeesToPaise(rupeeStr: string): number {
  const cleaned = rupeeStr.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

/**
 * Convert paise to a plain rupee string for display in input fields.
 * e.g. 125050 → "1250.50"
 */
export function paiseToRupeeString(paise: number): string {
  return (paise / 100).toFixed(2);
}
