import { createServerFn } from "@tanstack/react-start";
import type {
	JupiterExecuteError,
	JupiterExecuteResponse,
	JupiterHoldingsResponse,
	JupiterOrderResponse,
	JupiterToken,
	WalletHolding,
} from "../types/jupiter";

interface JupiterTokenResponse {
	id: string;
	name: string;
	symbol: string;
	icon?: string;
	decimals: number;
	tags?: string[];
	isVerified?: boolean;
}

interface SearchTokensInput {
	query: string;
	limit?: number;
}

export const searchTokens = createServerFn({ method: "GET" })
	.inputValidator((input: SearchTokensInput) => input)
	.handler(async ({ data, signal }): Promise<JupiterToken[]> => {
		const input = data;
		const apiKey = process.env.JUPITER_API_KEY;

		if (!apiKey) {
			console.error("JUPITER_API_KEY environment variable is not set");
			throw new Error("API configuration error");
		}

		const params = new URLSearchParams({ query: input.query });
		if (input.limit) {
			params.append("limit", input.limit.toString());
		}

		try {
			const response = await fetch(
				`https://api.jup.ag/ultra/v1/search?${params.toString()}`,
				{
					headers: {
						"x-api-key": apiKey,
					},
					signal,
				},
			);

			if (!response.ok) {
				console.error(
					`Jupiter API error: ${response.status} ${response.statusText}`,
				);
				throw new Error("Failed to fetch tokens from Jupiter API");
			}

			const data: JupiterTokenResponse[] = await response.json();

			// Transform to our client format
			return data.map((token) => ({
				address: token.id,
				name: token.name,
				symbol: token.symbol,
				logo: token.icon,
				decimals: token.decimals,
				tags: token.tags,
				isVerified: token.isVerified,
			}));
		} catch (error) {
			console.error("Error fetching tokens:", error);
			throw new Error("Failed to fetch tokens");
		}
	});

interface BatchSearchTokensInput {
	mintAddresses: string[];
}

export const batchSearchTokens = createServerFn({ method: "GET" })
	.inputValidator((input: BatchSearchTokensInput) => input)
	.handler(async ({ data, signal }): Promise<JupiterToken[]> => {
		const apiKey = process.env.JUPITER_API_KEY;

		if (!apiKey) {
			console.error("JUPITER_API_KEY environment variable is not set");
			throw new Error("API configuration error");
		}

		// Jupiter Ultra API supports up to 100 mint addresses comma-separated
		const MAX_BATCH_SIZE = 100;
		if (data.mintAddresses.length > MAX_BATCH_SIZE) {
			throw new Error(
				`Cannot fetch more than ${MAX_BATCH_SIZE} tokens at once`,
			);
		}

		if (data.mintAddresses.length === 0) {
			return [];
		}

		// Join mint addresses with commas
		const query = data.mintAddresses.join(",");

		try {
			const response = await fetch(
				`https://api.jup.ag/ultra/v1/search?query=${encodeURIComponent(query)}`,
				{
					headers: {
						"x-api-key": apiKey,
					},
					signal,
				},
			);

			if (!response.ok) {
				console.error(
					`Jupiter API error: ${response.status} ${response.statusText}`,
				);
				throw new Error("Failed to fetch tokens from Jupiter API");
			}

			const responseData: JupiterTokenResponse[] = await response.json();

			// Transform to our client format
			return responseData.map((token) => ({
				address: token.id,
				name: token.name,
				symbol: token.symbol,
				logo: token.icon,
				decimals: token.decimals,
				tags: token.tags,
				isVerified: token.isVerified,
			}));
		} catch (error) {
			console.error("Error fetching tokens:", error);
			throw new Error("Failed to fetch tokens");
		}
	});

interface GetOrderInput {
	inputMint: string;
	outputMint: string;
	amount: string;
	taker?: string;
}

export const getOrder = createServerFn({ method: "GET" })
	.inputValidator((input: GetOrderInput) => input)
	.handler(async ({ data, signal }): Promise<JupiterOrderResponse> => {
		const apiKey = process.env.JUPITER_API_KEY;

		if (!apiKey) {
			console.error("JUPITER_API_KEY environment variable is not set");
			throw new Error("API configuration error");
		}

		console.log("signal aborted?", signal.aborted, signal.reason);

		const params = new URLSearchParams({
			inputMint: data.inputMint,
			outputMint: data.outputMint,
			amount: data.amount,
		});

		if (data.taker) {
			params.append("taker", data.taker);
		}

		try {
			const response = await fetch(
				`https://api.jup.ag/ultra/v1/order?${params.toString()}`,
				{
					headers: {
						"x-api-key": apiKey,
					},
					signal,
				},
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error(
					`Jupiter API error: ${response.status} ${response.statusText}`,
					errorData,
				);
				throw new Error(
					errorData.error || "Failed to get order from Jupiter API",
				);
			}

			const orderData: JupiterOrderResponse = await response.json();
			return orderData;
		} catch (error) {
			console.error("Error fetching Jupiter order:", error);
			throw error;
		}
	});

interface ExecuteSwapInput {
	signedTransaction: string;
	requestId: string;
}

export const executeSwap = createServerFn({ method: "POST" })
	.inputValidator((input: ExecuteSwapInput) => input)
	.handler(
		async ({
			data,
			signal,
		}): Promise<JupiterExecuteResponse | JupiterExecuteError> => {
			const apiKey = process.env.JUPITER_API_KEY;

			if (!apiKey) {
				console.error("JUPITER_API_KEY environment variable is not set");
				throw new Error("API configuration error");
			}

			try {
				const response = await fetch("https://api.jup.ag/ultra/v1/execute", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": apiKey,
					},
					body: JSON.stringify({
						signedTransaction: data.signedTransaction,
						requestId: data.requestId,
					}),
					signal,
				});

				const responseData = await response.json();

				if (!response.ok) {
					console.error(
						`Jupiter execute API error: ${response.status} ${response.statusText}`,
						responseData,
					);
					// Return error response from Jupiter
					return responseData as JupiterExecuteError;
				}

				return responseData as JupiterExecuteResponse;
			} catch (error) {
				console.error("Error executing Jupiter swap:", error);
				throw error;
			}
		},
	);

interface GetWalletHoldingsInput {
	walletAddress: string;
}

export const getWalletHoldings = createServerFn({ method: "GET" })
	.inputValidator((input: GetWalletHoldingsInput) => input)
	.handler(async ({ data, signal }): Promise<WalletHolding[]> => {
		const apiKey = process.env.JUPITER_API_KEY;

		if (!apiKey) {
			console.error("JUPITER_API_KEY environment variable is not set");
			throw new Error("API configuration error");
		}

		try {
			const response = await fetch(
				`https://api.jup.ag/ultra/v1/holdings/${data.walletAddress}`,
				{
					headers: {
						"x-api-key": apiKey,
					},
					signal,
				},
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error(
					`Jupiter API error: ${response.status} ${response.statusText}`,
					errorData,
				);

				if (errorData.error === "Invalid address") {
					throw new Error("Invalid wallet address provided");
				}

				throw new Error(
					errorData.error || "Failed to fetch wallet holdings from Jupiter API",
				);
			}

			const holdingsData: JupiterHoldingsResponse = await response.json();

			// Sum amounts by mint address, using a Map to handle duplicate mints
			const holdingsMap = new Map<string, bigint>();

			// Add native SOL balance
			const solMint = "So11111111111111111111111111111111111111112";
			holdingsMap.set(solMint, BigInt(holdingsData.amount));

			// Add token balances, summing if SOL mint already exists
			for (const [mintAddress, tokenAccounts] of Object.entries(
				holdingsData.tokens,
			)) {
				let totalAmount = 0n;
				for (const tokenAccount of tokenAccounts) {
					totalAmount += BigInt(tokenAccount.amount);
				}

				// If this mint already exists (e.g., wrapped SOL), sum the amounts
				const existingAmount = holdingsMap.get(mintAddress) ?? 0n;
				holdingsMap.set(mintAddress, existingAmount + totalAmount);
			}

			// Convert Map to array
			const holdings: WalletHolding[] = Array.from(holdingsMap.entries()).map(
				([mintAddress, amount]) => ({
					mintAddress,
					amount,
				}),
			);

			return holdings;
		} catch (error) {
			console.error("Error fetching wallet holdings:", error);
			throw error;
		}
	});
