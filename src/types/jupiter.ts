import type { Address, Signature } from "@solana/kit";

type StringifiedNumber = string;

export interface JupiterToken {
	address: Address;
	name: string;
	symbol: string;
	logo?: string;
	decimals: number;
	tags?: string[];
	isVerified?: boolean;
	usdPrice?: number;
}

export interface JupiterOrderResponse {
	mode: string;
	inAmount: StringifiedNumber;
	outAmount: StringifiedNumber;
	otherAmountThreshold: StringifiedNumber;
	swapMode: string;
	slippageBps: number;
	priceImpactPct: StringifiedNumber;
	routePlan: Array<{
		// biome-ignore lint/suspicious/noExplicitAny: Jupiter API returns dynamic swap info
		swapInfo: Record<string, any>;
		percent: number;
		bps: number;
	}>;
	feeMint: Address;
	feeBps: number;
	taker?: Address;
	gasless: boolean;
	signatureFeeLamports: number;
	transaction?: string;
	prioritizationFeeLamports: number;
	rentFeeLamports: number;
	inputMint: Address;
	outputMint: Address;
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

export interface JupiterExecuteResponse {
	status: string;
	signature: Signature;
	slot: StringifiedNumber;
	code: number;
	inputAmountResult: StringifiedNumber;
	outputAmountResult: StringifiedNumber;
	swapEvents: Array<{
		inputMint: Address;
		inputAmount: StringifiedNumber;
		outputMint: Address;
		outputAmount: StringifiedNumber;
	}>;
}

export interface JupiterExecuteError {
	code: number;
	error: string;
}

export interface JupiterHoldingsResponse {
	amount: string;
	uiAmount: number;
	uiAmountString: StringifiedNumber;
	tokens: {
		[mintAddress: Address]: Array<{
			account: Address;
			amount: StringifiedNumber;
			uiAmount: number;
			uiAmountString: StringifiedNumber;
			isFrozen: boolean;
			isAssociatedTokenAccount: boolean;
			decimals: number;
			programId: Address;
		}>;
	};
}

export interface WalletHolding {
	mintAddress: Address;
	amount: bigint;
}
