import { createServerFn } from "@tanstack/react-start";
import type {
	JupiterExecuteError,
	JupiterExecuteResponse,
	JupiterOrderResponse,
	JupiterToken,
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
	.handler(async ({ data }): Promise<JupiterToken[]> => {
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

interface GetOrderInput {
	inputMint: string;
	outputMint: string;
	amount: string;
	taker?: string;
}

export const getOrder = createServerFn({ method: "GET" })
	.inputValidator((input: GetOrderInput) => input)
	.handler(async ({ data }): Promise<JupiterOrderResponse> => {
		const apiKey = process.env.JUPITER_API_KEY;

		if (!apiKey) {
			console.error("JUPITER_API_KEY environment variable is not set");
			throw new Error("API configuration error");
		}

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
