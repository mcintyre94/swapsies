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
 * Formats a USD currency value with $ sign and commas
 */
export function formatUSD(value: number, decimals = 2): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	}).format(value);
}

/**
 * Formats a token amount with appropriate decimals
 * Uses up to 6 decimals but removes trailing zeros
 */
export function formatTokenAmount(value: number, maxDecimals = 6): string {
	return new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 0,
		maximumFractionDigits: maxDecimals,
	}).format(value);
}
