import { isAddress } from "@solana/kit";

/**
 * Validates an array of address strings
 * @param addresses - Array of address strings to validate
 * @returns Object with valid addresses and invalid ones
 */
export function validateAddresses(addresses: string[]): {
	valid: string[];
	invalid: string[];
} {
	const valid: string[] = [];
	const invalid: string[] = [];

	for (const addr of addresses) {
		if (isAddress(addr)) {
			valid.push(addr);
		} else {
			invalid.push(addr);
		}
	}

	return { valid, invalid };
}

/**
 * Validates that a number is non-negative (zero or greater)
 * Allows zero for airdrops and tokens received for free
 * @param value - The number to validate
 * @returns true if non-negative, false otherwise
 */
export function isNonNegativeNumber(value: number): boolean {
	return typeof value === "number" && !Number.isNaN(value) && value >= 0;
}

/**
 * Validates that a number is within a reasonable range
 * @param value - The number to validate
 * @param max - Maximum allowed value (default: 1e15)
 * @returns true if within range, false otherwise
 */
export function isWithinRange(value: number, max = 1e15): boolean {
	return (
		typeof value === "number" &&
		!Number.isNaN(value) &&
		value >= 0 &&
		value <= max
	);
}
