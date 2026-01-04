import { isNonNegativeNumber } from "./validation";

/**
 * Generates a CSV string from cost basis data
 * Format: address,cost_basis
 * @param data - Record mapping token addresses to cost basis values
 * @returns CSV string with header row
 */
export function generateCostBasisCSV(data: Record<string, number>): string {
	const rows: string[] = ["address,cost_basis"];

	for (const [address, costBasis] of Object.entries(data)) {
		rows.push(`${address},${costBasis}`);
	}

	return rows.join("\n");
}

/**
 * Parses a CSV string into cost basis data
 * Expected format: address,cost_basis
 * @param content - CSV file content as string
 * @returns Record mapping token addresses to cost basis values
 * @throws Error if CSV format is invalid
 */
export function parseCostBasisCSV(content: string): Record<string, number> {
	const lines = content.split("\n");
	const result: Record<string, number> = {};

	// Validate and skip header row
	const header = lines[0]?.trim();
	if (header !== "address,cost_basis") {
		throw new Error("Invalid CSV format: Expected header 'address,cost_basis'");
	}

	// Parse data rows
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();

		// Skip empty rows
		if (line === "") continue;

		const parts = line.split(",");

		// Validate row has exactly 2 columns
		if (parts.length !== 2) {
			throw new Error(
				`Invalid CSV format: Row ${i + 1} has ${parts.length} columns (expected 2)`,
			);
		}

		const address = parts[0].trim();
		const costBasisStr = parts[1].trim();

		// Parse cost basis as number
		const costBasis = Number.parseFloat(costBasisStr);

		// Validate cost basis is a valid non-negative number
		if (Number.isNaN(costBasis)) {
			throw new Error(
				`Invalid cost basis value '${costBasisStr}' at row ${i + 1}: must be a number`,
			);
		}

		if (!isNonNegativeNumber(costBasis)) {
			throw new Error(
				`Invalid cost basis value '${costBasisStr}' at row ${i + 1}: must be a non-negative number`,
			);
		}

		result[address] = costBasis;
	}

	// Check if any data was parsed
	if (Object.keys(result).length === 0) {
		throw new Error("No cost basis entries found in file");
	}

	return result;
}
