import type { StoredCostBasis } from "./cost-basis";
import { isNonNegativeNumber } from "./validation";

/**
 * Generates a CSV string from cost basis data
 * Format: address,cost_basis,Total Balance,Total Cost
 * @param data - Record mapping token addresses to StoredCostBasis entries
 * @returns CSV string with header row
 */
export function generateCostBasisCSV(
	data: Record<string, StoredCostBasis>,
): string {
	const rows: string[] = ["address,cost_basis,Total Balance,Total Cost"];

	for (const [address, entry] of Object.entries(data)) {
		const balance = entry.totalBalance !== undefined ? entry.totalBalance : "";
		const cost = entry.totalCost !== undefined ? entry.totalCost : "";
		rows.push(`${address},${entry.costBasisUSD},${balance},${cost}`);
	}

	return rows.join("\n");
}

export interface ParsedCostBasisEntry {
	costBasis: number;
	totalBalance?: number;
	totalCost?: number;
}

/**
 * Parses a CSV string into cost basis data
 * Supports old format (address,cost_basis) and new format (address,cost_basis,Total Balance,Total Cost)
 * @param content - CSV file content as string
 * @returns Record mapping token addresses to parsed cost basis entries
 * @throws Error if CSV format is invalid
 */
export function parseCostBasisCSV(
	content: string,
): Record<string, ParsedCostBasisEntry> {
	const lines = content.split("\n");
	const result: Record<string, ParsedCostBasisEntry> = {};

	// Validate and skip header row — accept both old and new format
	const header = lines[0]?.trim();
	const hasExtendedColumns =
		header === "address,cost_basis,Total Balance,Total Cost";
	if (header !== "address,cost_basis" && !hasExtendedColumns) {
		throw new Error("Invalid CSV format: Expected header 'address,cost_basis'");
	}

	const expectedColumns = hasExtendedColumns ? 4 : 2;

	// Parse data rows
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();

		// Skip empty rows
		if (line === "") continue;

		const parts = line.split(",");

		// Validate row has expected number of columns
		if (parts.length !== expectedColumns) {
			throw new Error(
				`Invalid CSV format: Row ${i + 1} has ${parts.length} columns (expected ${expectedColumns})`,
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

		const entry: ParsedCostBasisEntry = { costBasis };

		if (hasExtendedColumns) {
			const balanceStr = parts[2].trim();
			const costStr = parts[3].trim();
			if (balanceStr !== "") {
				const balance = Number.parseFloat(balanceStr);
				if (!Number.isNaN(balance)) entry.totalBalance = balance;
			}
			if (costStr !== "") {
				const cost = Number.parseFloat(costStr);
				if (!Number.isNaN(cost)) entry.totalCost = cost;
			}
		}

		result[address] = entry;
	}

	// Check if any data was parsed
	if (Object.keys(result).length === 0) {
		throw new Error("No cost basis entries found in file");
	}

	return result;
}
