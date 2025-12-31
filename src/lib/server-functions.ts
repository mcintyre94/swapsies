import { createServerFn } from "@tanstack/react-start";
import type { JupiterToken } from "../types/jupiter";

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
