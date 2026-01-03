export interface StoredCostBasis {
	tokenAddress: string;
	costBasisUSD: number;
	tokenName: string;
	tokenSymbol: string;
	tokenLogo?: string;
	isVerified?: boolean;
}

export const COST_BASIS_STORAGE_KEY = "costBasisData";

// Helper functions for localStorage operations
export function getCostBasisData(): Record<string, StoredCostBasis> {
	try {
		const data = localStorage.getItem(COST_BASIS_STORAGE_KEY);
		return data ? JSON.parse(data) : {};
	} catch (error) {
		console.error("Failed to read cost basis data:", error);
		return {};
	}
}

export function saveCostBasisData(
	data: Record<string, StoredCostBasis>,
): boolean {
	try {
		localStorage.setItem(COST_BASIS_STORAGE_KEY, JSON.stringify(data));
		return true;
	} catch (error) {
		console.error("Failed to save cost basis data:", error);
		return false;
	}
}

// Get cost basis for a specific token
export function getCostBasisForToken(
	tokenAddress: string,
): StoredCostBasis | null {
	const data = getCostBasisData();
	return data[tokenAddress] || null;
}
