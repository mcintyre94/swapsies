export interface JupiterToken {
	address: string;
	name: string;
	symbol: string;
	logo?: string;
	decimals: number;
	tags?: string[];
	isVerified?: boolean;
}

export interface JupiterOrderResponse {
	mode: string;
	inAmount: string;
	outAmount: string;
	otherAmountThreshold: string;
	swapMode: string;
	slippageBps: number;
	priceImpactPct: string;
	routePlan: Array<{
		// biome-ignore lint/suspicious/noExplicitAny: Jupiter API returns dynamic swap info
		swapInfo: Record<string, any>;
		percent: number;
		bps: number;
	}>;
	feeMint: string;
	feeBps: number;
	taker?: string;
	gasless: boolean;
	signatureFeeLamports: number;
	transaction?: string;
	prioritizationFeeLamports: number;
	rentFeeLamports: number;
	inputMint: string;
	outputMint: string;
	swapType: string;
	router: string;
	requestId: string;
	inUsdValue: number;
	outUsdValue: number;
	priceImpact: number;
	swapUsdValue: number;
	totalTime: number;
	errorCode?: string;
	errorMessage?: string;
}
