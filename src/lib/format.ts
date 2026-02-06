/**
 * Formats a number with comma separators and specified decimal places
 */
export function formatNumber(
	value: number,
	decimals = 2,
	options?: Intl.NumberFormatOptions,
): string {
	return new Intl.NumberFormat("en-US", {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
		...options,
	}).format(value);
}

/**
 * Counts leading zeros after decimal point in a number
 * For example: 0.00123 has 2 leading zeros
 */
function countLeadingZeros(value: number): number {
	if (value >= 1 || value === 0) return 0;

	const str = value.toString();

	// Handle scientific notation (e.g., "4e-7")
	if (str.includes("e-")) {
		const [, exponent] = str.split("e-");
		return Number.parseInt(exponent, 10) - 1;
	}

	const match = str.match(/^0\.0+/);
	if (!match) return 0;

	return match[0].length - 2; // Subtract "0."
}

/**
 * Formats a small number with subscript notation for leading zeros
 * For example: 0.00123 becomes "0.0₂123"
 * Returns null if the number shouldn't use subscript notation
 */
function formatWithSubscript(
	value: number,
	leadingZeros: number,
	significantDigits = 3,
): string | null {
	if (leadingZeros < 3) return null; // Only use subscript for 3+ leading zeros

	// Convert to string and extract the significant digits after the leading zeros
	const multiplier = 10 ** (leadingZeros + significantDigits);
	const shifted = Math.round(value * multiplier);
	const significantPart = shifted.toString().slice(0, significantDigits);

	// Convert the number of zeros to subscript
	const subscriptDigits = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
	const subscript = leadingZeros
		.toString()
		.split("")
		.map((d) => subscriptDigits[Number.parseInt(d, 10)])
		.join("");

	return `0.0${subscript}${significantPart}`;
}

/**
 * Formats a USD currency value with $ sign and commas
 * For very small values (< 0.001), uses subscript notation like "$0.0₅1234"
 */
export function formatUSD(value: number, decimals = 2): string {
	const absValue = Math.abs(value);
	const sign = value < 0 ? "-" : "";

	// Check if we should use subscript notation
	const leadingZeros = countLeadingZeros(absValue);
	const subscriptFormat = formatWithSubscript(absValue, leadingZeros, 4);

	if (subscriptFormat) {
		return `${sign}$${subscriptFormat}`;
	}

	// Default formatting for normal-sized numbers
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	}).format(value);
}

/**
 * Formats a USD value, showing "<$0.01" for very small positive amounts
 */
export function formatUSDCompact(value: number): string {
	if (value > 0 && value < 0.01) return "<$0.01";
	if (value < 0 && value > -0.01) return "-<$0.01";
	return formatUSD(value);
}

/**
 * Formats a token amount with appropriate decimals
 * Uses up to 6 decimals but removes trailing zeros
 * For very small values (< 0.001), uses subscript notation like "0.0₅1234"
 */
export function formatTokenAmount(value: number, maxDecimals = 6): string {
	const absValue = Math.abs(value);
	const sign = value < 0 ? "-" : "";

	// Check if we should use subscript notation
	const leadingZeros = countLeadingZeros(absValue);
	const subscriptFormat = formatWithSubscript(absValue, leadingZeros, 4);

	if (subscriptFormat) {
		return `${sign}${subscriptFormat}`;
	}

	// Default formatting for normal-sized numbers
	return new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 0,
		maximumFractionDigits: maxDecimals,
	}).format(value);
}
