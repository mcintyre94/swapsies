import { isAddress } from "@solana/kit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useWalletUiAccount, WalletUiDropdown } from "@wallet-ui/react";
import { ArrowDownUp, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import SwapButton from "../components/SwapButton";
import TokenSelectionModal from "../components/TokenSelectionModal";
import { getCostBasisForToken } from "../lib/cost-basis";
import {
	formatNumber,
	formatTokenAmount,
	formatUSD,
	formatUSDCompact,
} from "../lib/format";
import {
	getOrder,
	getWalletHoldings,
	searchTokens,
} from "../lib/server-functions";
import type { JupiterOrderResponse, JupiterToken } from "../types/jupiter";

function CompactUSD({ value }: { value: number }) {
	const isCompact = (value > 0 && value < 0.01) || (value < 0 && value > -0.01);
	if (!isCompact) return <>{formatUSDCompact(value)}</>;
	return (
		<span className="relative group">
			{formatUSDCompact(value)}
			<span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-slate-700 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
				{formatUSD(value, 6)}
			</span>
		</span>
	);
}

interface SwapSearchParams {
	inputMint?: string;
}

export const Route = createFileRoute("/")({
	component: SwapPage,
	validateSearch: (search: Record<string, unknown>): SwapSearchParams => {
		const inputMint = search.inputMint;
		if (typeof inputMint === "string" && isAddress(inputMint)) {
			return { inputMint };
		}
		return {};
	},
});

type TokenSelectMode = "input" | "output" | null;

function SwapPage() {
	const { inputMint } = Route.useSearch();
	const queryClient = useQueryClient();
	const [inputToken, setInputToken] = useState<JupiterToken | null>(null);
	const [outputToken, setOutputToken] = useState<JupiterToken | null>(null);
	const [amount, setAmount] = useState("");
	const [selectMode, setSelectMode] = useState<TokenSelectMode>(null);
	const [costExpanded, setCostExpanded] = useState(false);
	const { account } = useWalletUiAccount();
	const inputTokenButtonRef = useRef<HTMLButtonElement>(null);
	const outputTokenButtonRef = useRef<HTMLButtonElement>(null);

	// Track if we've already applied the inputMint from URL
	const appliedInputMintRef = useRef<string | null>(null);

	// Fetch token from inputMint query param
	const { data: inputMintToken } = useQuery({
		queryKey: ["token-by-mint", inputMint],
		queryFn: ({ signal }) =>
			searchTokens({ data: { query: inputMint as string, limit: 1 }, signal }),
		enabled: !!inputMint && appliedInputMintRef.current !== inputMint,
		staleTime: Number.POSITIVE_INFINITY,
	});

	// Set input token from URL param (only once per inputMint value)
	useEffect(() => {
		if (
			inputMintToken &&
			inputMintToken.length > 0 &&
			inputMint &&
			appliedInputMintRef.current !== inputMint
		) {
			// Find exact match by address
			const exactMatch = inputMintToken.find(
				(token) => token.address === inputMint,
			);
			if (exactMatch) {
				setInputToken(exactMatch);
				appliedInputMintRef.current = inputMint;
			}
		}
	}, [inputMintToken, inputMint]);

	// Debounce amount to avoid excessive quote requests
	const [debouncedAmount, setDebouncedAmount] = useState(amount);
	useEffect(() => {
		const timeoutId = setTimeout(() => {
			setDebouncedAmount(amount);
		}, 300);
		return () => clearTimeout(timeoutId);
	}, [amount]);

	// Fetch wallet holdings
	const { data: holdings = [] } = useQuery({
		queryKey: ["holdings", account?.address],
		queryFn: ({ signal }) =>
			account?.address
				? getWalletHoldings({
						data: { walletAddress: account.address },
						signal,
					})
				: Promise.resolve([]),
		enabled: !!account?.address,
		staleTime: 30 * 1000, // Cache for 30 seconds
	});

	// Get balance for selected input token
	const inputTokenBalance = useMemo(() => {
		if (!inputToken || holdings.length === 0) return null;
		const holding = holdings.find((h) => h.mintAddress === inputToken.address);
		if (!holding) return 0n;
		return holding.amount;
	}, [inputToken, holdings]);

	// Convert balance to UI amount
	const inputTokenBalanceUI = useMemo(() => {
		if (inputTokenBalance === null || !inputToken) return null;
		return Number(inputTokenBalance) / 10 ** inputToken.decimals;
	}, [inputTokenBalance, inputToken]);

	// Check if amount exceeds balance
	const isAmountExceedingBalance = useMemo(() => {
		if (!amount || inputTokenBalanceUI === null) return false;
		const amountNum = Number.parseFloat(amount);
		if (Number.isNaN(amountNum)) return false;
		return amountNum > inputTokenBalanceUI;
	}, [amount, inputTokenBalanceUI]);

	// Handler functions for half/max buttons
	const handleSetHalf = () => {
		if (inputTokenBalanceUI !== null) {
			setAmount((inputTokenBalanceUI / 2).toString());
		}
	};

	const handleSetMax = () => {
		if (inputTokenBalanceUI !== null) {
			setAmount(inputTokenBalanceUI.toString());
		}
	};

	// Load default tokens (top 2 from Jupiter)
	const { data: defaultTokens } = useQuery({
		queryKey: ["tokens", "", 2],
		queryFn: ({ signal }) =>
			searchTokens({ data: { query: "", limit: 2 }, signal }),
		staleTime: Number.POSITIVE_INFINITY, // Cache forever
	});

	// Set default tokens on mount (but not if inputMint is provided and we're still loading)
	useEffect(() => {
		if (defaultTokens && defaultTokens.length >= 2) {
			// If inputMint is provided, only set output token as default (input will come from URL)
			if (inputMint) {
				if (!outputToken) {
					// Set output to the second default token, or first if input matches second
					const outputDefault =
						defaultTokens[1].address === inputMint
							? defaultTokens[0]
							: defaultTokens[1];
					setOutputToken(outputDefault);
				}
			} else if (!inputToken && !outputToken) {
				// No inputMint param - use both defaults
				setInputToken(defaultTokens[0]);
				setOutputToken(defaultTokens[1]);
			}
		}
	}, [defaultTokens, inputToken, outputToken, inputMint]);

	const handleSwapTokens = () => {
		const temp = inputToken;
		setInputToken(outputToken);
		setOutputToken(temp);
	};

	// Calculate amount in native units (before decimals)
	const nativeAmount = useMemo(() => {
		if (!debouncedAmount || !inputToken) return null;
		const amountNum = Number.parseFloat(debouncedAmount);
		if (Number.isNaN(amountNum) || amountNum <= 0) return null;
		return Math.floor(amountNum * 10 ** inputToken.decimals).toString();
	}, [debouncedAmount, inputToken]);

	// Fetch quote when inputs change
	const {
		data: quote,
		isLoading: isLoadingQuote,
		error: quoteError,
	} = useQuery<JupiterOrderResponse>({
		queryKey: [
			"order",
			inputToken?.address,
			outputToken?.address,
			nativeAmount,
			account?.address,
		],
		queryFn: ({ signal }) => {
			// These are guaranteed to exist because of the enabled check
			if (!inputToken || !outputToken || !nativeAmount) {
				throw new Error("Missing required parameters");
			}
			return getOrder({
				data: {
					inputMint: inputToken.address,
					outputMint: outputToken.address,
					amount: nativeAmount,
					taker: account?.address,
				},
				signal,
			});
		},
		enabled: !!(inputToken && outputToken && nativeAmount),
		staleTime: 0, // Always fetch fresh quotes
		gcTime: 30 * 1000, // Keep cached for 30 seconds to show while refetching
		refetchInterval: 5 * 1000, // Refetch every 5 seconds to keep quotes fresh
	});

	// Calculate output amount from quote
	const outputAmount = useMemo(() => {
		if (!quote || !outputToken) return null;
		const amount = Number.parseInt(quote.outAmount, 10);
		return amount / 10 ** outputToken.decimals;
	}, [quote, outputToken]);

	// Get cost basis data for input token
	const inputTokenCostBasis = useMemo(() => {
		if (!inputToken) return null;
		return getCostBasisForToken(inputToken.address);
	}, [inputToken]);

	// Extract user-paid network fee in lamports
	const userFeeLamports = useMemo(() => {
		if (!quote) return 0;
		if (!quote.transaction || !account?.address) return null;
		if (
			!quote.signatureFeePayer &&
			!quote.prioritizationFeePayer &&
			!quote.rentFeePayer
		) {
			return null;
		}
		const addr = account.address;
		return (
			(quote.signatureFeePayer === addr ? quote.signatureFeeLamports : 0) +
			(quote.prioritizationFeePayer === addr
				? quote.prioritizationFeeLamports
				: 0) +
			(quote.rentFeePayer === addr ? quote.rentFeeLamports : 0)
		);
	}, [quote, account?.address]);

	// Fetch SOL price for network fee USD conversion
	const SOL_MINT = "So11111111111111111111111111111111111111112";
	const { data: solTokenData } = useQuery({
		queryKey: ["tokens", SOL_MINT, 1],
		queryFn: ({ signal }) =>
			searchTokens({ data: { query: SOL_MINT, limit: 1 }, signal }),
		enabled: !!userFeeLamports && userFeeLamports > 0,
		staleTime: 30 * 1000,
		refetchInterval: 30 * 1000,
	});
	const solPrice = solTokenData?.[0]?.usdPrice ?? null;

	// Compute full cost breakdown in USD
	const costBreakdown = useMemo(() => {
		if (!quote) return null;
		const isInputFee = quote.feeMint === inputToken?.address;
		const platformFeeUSD =
			(isInputFee ? quote.inUsdValue : quote.outUsdValue) *
			(quote.feeBps / 10000);
		const networkFeeUSD =
			userFeeLamports && userFeeLamports > 0 && solPrice
				? (userFeeLamports / 1e9) * solPrice
				: 0;
		const networkFeeKnown =
			userFeeLamports !== null && (userFeeLamports === 0 || solPrice !== null);
		const priceImpactUSD = quote.inUsdValue - quote.outUsdValue;
		const totalCostUSD = priceImpactUSD + platformFeeUSD + networkFeeUSD;
		const totalCostPct =
			quote.inUsdValue > 0 ? (totalCostUSD / quote.inUsdValue) * 100 : 0;
		return {
			platformFeeUSD,
			networkFeeUSD,
			networkFeeKnown,
			priceImpactUSD,
			totalCostUSD,
			totalCostPct,
			isGasless: quote.gasless && userFeeLamports === 0,
		};
	}, [quote, inputToken?.address, userFeeLamports, solPrice]);

	// Calculate cost basis metrics
	const costBasisMetrics = useMemo(() => {
		if (!inputTokenCostBasis || !quote || !debouncedAmount) return null;

		const amountNum = Number.parseFloat(debouncedAmount);
		if (Number.isNaN(amountNum) || amountNum <= 0) return null;

		const costBasisPerToken = inputTokenCostBasis.costBasisUSD;
		const totalCostBasis = costBasisPerToken * amountNum;
		const fees =
			(costBreakdown?.platformFeeUSD ?? 0) +
			(costBreakdown?.networkFeeUSD ?? 0);
		const realizedGainLoss = quote.outUsdValue - fees - totalCostBasis;
		const gainLossPercentage = (realizedGainLoss / totalCostBasis) * 100;

		return {
			costBasisPerToken,
			totalCostBasis,
			realizedGainLoss,
			gainLossPercentage,
		};
	}, [inputTokenCostBasis, quote, debouncedAmount, costBreakdown]);

	return (
		<div className="min-h-screen p-4 sm:p-8">
			<div className="max-w-2xl mx-auto">
				<div className="flex justify-between items-start mb-4 sm:mb-8">
					<div>
						<h1 className="text-4xl font-bold mb-2">Swap</h1>
					</div>
					<WalletUiDropdown />
				</div>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						// Form submission is handled by SwapButton component
					}}
					noValidate
				>
					<div className="bg-slate-800 rounded-lg p-4 sm:p-6">
						{/* Input Token */}
						<div className="mb-4">
							<div className="block text-sm font-medium mb-2">Swap your</div>
							<div className="flex gap-2">
								<button
									ref={inputTokenButtonRef}
									type="button"
									onClick={() => setSelectMode("input")}
									className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors min-w-[120px] sm:min-w-[140px]"
								>
									{inputToken ? (
										<>
											{inputToken.logo && (
												<img
													src={inputToken.logo}
													alt={inputToken.symbol}
													className="w-6 h-6 rounded-full"
												/>
											)}
											<span>{inputToken.symbol}</span>
										</>
									) : inputMint && !appliedInputMintRef.current ? (
										<span className="text-slate-400">Loading...</span>
									) : (
										<span>Select token</span>
									)}
								</button>
								<input
									type="number"
									step="any"
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
									onWheel={(e) => e.currentTarget.blur()}
									placeholder="0.00"
									className={`flex-1 min-w-0 px-4 py-3 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 ${
										isAmountExceedingBalance
											? "ring-2 ring-red-500 focus:ring-red-500"
											: "focus:ring-cyan-500"
									}`}
								/>
							</div>
							{account && inputToken && inputTokenBalanceUI !== null && (
								<div className="mt-2 flex items-center justify-between text-sm">
									<button
										type="button"
										onClick={handleSetMax}
										className="text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
									>
										Balance: {formatTokenAmount(inputTokenBalanceUI)}{" "}
										{inputToken.symbol}
									</button>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={handleSetHalf}
											className="text-cyan-400 hover:text-cyan-300 transition-colors"
										>
											Half
										</button>
										<span className="text-slate-600">|</span>
										<button
											type="button"
											onClick={handleSetMax}
											className="text-cyan-400 hover:text-cyan-300 transition-colors"
										>
											Max
										</button>
									</div>
								</div>
							)}
							{isAmountExceedingBalance && (
								<div className="mt-2 text-sm text-red-400">
									Amount exceeds your balance
								</div>
							)}
						</div>

						{/* Swap button */}
						<div className="flex justify-center -my-2 relative z-10">
							<button
								type="button"
								onClick={handleSwapTokens}
								disabled={!inputToken || !outputToken}
								className="p-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed rounded-lg transition-colors"
							>
								<ArrowDownUp className="w-5 h-5" />
							</button>
						</div>

						{/* Output Token */}
						<div className="mb-4">
							<div className="block text-sm font-medium mb-2">To receive</div>
							<div className="flex gap-2">
								<button
									ref={outputTokenButtonRef}
									type="button"
									onClick={() => setSelectMode("output")}
									className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors min-w-[120px] sm:min-w-[140px]"
								>
									{outputToken ? (
										<>
											{outputToken.logo && (
												<img
													src={outputToken.logo}
													alt={outputToken.symbol}
													className="w-6 h-6 rounded-full"
												/>
											)}
											<span>{outputToken.symbol}</span>
										</>
									) : (
										<span>Select token</span>
									)}
								</button>
								<div className="flex-1 flex items-center text-lg">
									{isLoadingQuote ? (
										<span className="text-slate-400">Loading...</span>
									) : outputAmount !== null ? (
										<span className="text-white">
											{formatTokenAmount(outputAmount)}
										</span>
									) : (
										<span className="text-slate-400">0.00</span>
									)}
								</div>
							</div>
						</div>

						{/* Quote details */}
						{quote && (
							<>
								<div className="mt-6 p-3 sm:p-4 bg-slate-700/50 rounded-lg space-y-2 text-sm">
									<div className="flex justify-between">
										<span className="text-slate-400">Rate</span>
										<span>
											1 {inputToken?.symbol} ≈{" "}
											{formatTokenAmount(
												(Number.parseFloat(quote.outAmount) /
													Number.parseFloat(quote.inAmount)) *
													(10 ** (inputToken?.decimals || 0) /
														10 ** (outputToken?.decimals || 0)),
											)}{" "}
											{outputToken?.symbol}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-slate-400">Price Impact</span>
										<span
											className={
												Math.abs(quote.priceImpact) <= 0.1
													? "text-green-400"
													: Math.abs(quote.priceImpact) <= 1
														? "text-yellow-400"
														: "text-red-400"
											}
										>
											{formatNumber(quote.priceImpact, 2)}%
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-slate-400">Input Value</span>
										<span>{formatUSD(quote.inUsdValue)}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-slate-400">Output Value</span>
										<span>{formatUSD(quote.outUsdValue)}</span>
									</div>

									{/* Fees & Costs */}
									<div className="pt-2 mt-2 border-t border-slate-600/50 space-y-2">
										<div className="flex justify-between">
											<span className="text-slate-400">Platform Fee</span>
											<span className="text-slate-300">
												{(() => {
													const isInputFee =
														quote.feeMint === inputToken?.address;
													const feeToken = isInputFee
														? inputToken
														: outputToken;
													const rawAmount = isInputFee
														? quote.inAmount
														: quote.outAmount;
													const feeAmount =
														(Number.parseInt(rawAmount, 10) /
															10 ** (feeToken?.decimals || 0)) *
														(quote.feeBps / 10000);
													const feeDisplay =
														feeAmount > 0 && feeAmount < 0.001
															? "<0.001"
															: formatTokenAmount(feeAmount);
													return (
														<>
															{formatNumber(quote.feeBps / 100, 2)}% (
															<span className="relative group">
																{feeDisplay}
																{feeAmount > 0 && feeAmount < 0.001 && (
																	<span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-slate-700 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
																		{formatTokenAmount(feeAmount)}{" "}
																		{feeToken?.symbol}
																	</span>
																)}
															</span>{" "}
															{feeToken?.symbol})
														</>
													);
												})()}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-slate-400">Network Fee</span>
											<span className="text-slate-300">
												{(() => {
													if (userFeeLamports === null) {
														return (
															<span className="text-slate-500 text-sm">
																Unable to estimate
															</span>
														);
													}
													if (quote.gasless && userFeeLamports === 0) {
														return "Gasless";
													}
													const feeSol = userFeeLamports / 1e9;
													const feeDisplay =
														feeSol > 0 && feeSol < 0.001
															? "<0.001"
															: formatTokenAmount(feeSol);
													return (
														<>
															<span className="relative group">
																{feeDisplay}
																{feeSol > 0 && feeSol < 0.001 && (
																	<span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-slate-700 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
																		{formatTokenAmount(feeSol)} SOL
																	</span>
																)}
															</span>{" "}
															SOL
														</>
													);
												})()}
											</span>
										</div>
										{costBreakdown && (
											<div>
												<button
													type="button"
													onClick={() => setCostExpanded((v) => !v)}
													className="flex justify-between items-center w-full text-left"
												>
													<span className="text-slate-400 flex items-center gap-1">
														Estimated Cost
														<ChevronDown
															className={`w-3.5 h-3.5 transition-transform ${costExpanded ? "rotate-180" : ""}`}
														/>
													</span>
													<span
														className={
															costBreakdown.totalCostUSD <= 0
																? "text-green-400"
																: costBreakdown.totalCostPct <= 0.1
																	? "text-slate-300"
																	: costBreakdown.totalCostPct <= 1
																		? "text-yellow-400"
																		: "text-red-400"
														}
													>
														<CompactUSD value={costBreakdown.totalCostUSD} /> (
														{formatNumber(costBreakdown.totalCostPct)}%)
													</span>
												</button>
												<div
													className={`grid transition-[grid-template-rows] duration-200 ${costExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
												>
													<div className="overflow-hidden">
														<div className="pt-2 pl-3 space-y-1.5">
															<div className="flex justify-between text-xs">
																<span className="text-slate-400">
																	Price Impact
																</span>
																<span className="text-slate-300">
																	<CompactUSD
																		value={costBreakdown.priceImpactUSD}
																	/>
																</span>
															</div>
															<div className="flex justify-between text-xs">
																<span className="text-slate-400">
																	Platform Fee
																</span>
																<span className="text-slate-300">
																	<CompactUSD
																		value={costBreakdown.platformFeeUSD}
																	/>
																</span>
															</div>
															<div className="flex justify-between text-xs">
																<span className="text-slate-400">
																	Network Fee
																</span>
																<span className="text-slate-300">
																	{costBreakdown.isGasless ? (
																		"Gasless"
																	) : userFeeLamports === null ? (
																		"Unable to estimate"
																	) : !costBreakdown.networkFeeKnown ? (
																		"..."
																	) : (
																		<CompactUSD
																			value={costBreakdown.networkFeeUSD}
																		/>
																	)}
																</span>
															</div>
														</div>
													</div>
												</div>
											</div>
										)}
									</div>

									{/* Cost Basis Section */}
									<div className="pt-2 mt-2 border-t border-slate-600/50 space-y-2">
										{inputTokenCostBasis && costBasisMetrics ? (
											<>
												<div className="flex justify-between">
													<span className="text-slate-400">Cost Basis</span>
													<span className="text-sm">
														{formatUSD(costBasisMetrics.costBasisPerToken, 4)}{" "}
														per {inputToken?.symbol}
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-slate-400">
														Total Cost Basis
													</span>
													<span>
														{formatUSD(costBasisMetrics.totalCostBasis)}
													</span>
												</div>
												<div className="flex justify-between items-center">
													<span className="text-slate-400">
														Estimated Gain/Loss
													</span>
													<div className="text-right">
														<div
															className={
																costBasisMetrics.realizedGainLoss >= 0
																	? "text-green-400"
																	: "text-red-400"
															}
														>
															{costBasisMetrics.realizedGainLoss >= 0
																? "+"
																: ""}
															{formatUSD(costBasisMetrics.realizedGainLoss)}
														</div>
														<div
															className={`text-xs ${
																costBasisMetrics.realizedGainLoss >= 0
																	? "text-green-400/70"
																	: "text-red-400/70"
															}`}
														>
															(
															{costBasisMetrics.realizedGainLoss >= 0
																? "+"
																: ""}
															{formatNumber(
																costBasisMetrics.gainLossPercentage,
																2,
															)}
															%)
														</div>
													</div>
												</div>
											</>
										) : inputToken ? (
											<div className="flex justify-between items-center">
												<span className="text-slate-400">Cost Basis</span>
												<Link
													to="/cost-basis"
													className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm underline"
												>
													Add cost basis
												</Link>
											</div>
										) : null}
									</div>
								</div>

								{quote.errorCode && (
									<div className="mt-4 p-4 bg-red-900/20 border border-red-900/50 rounded-lg">
										<p className="text-red-400">
											{quote.errorMessage || "Failed to get quote"}
										</p>
									</div>
								)}
							</>
						)}

						{quoteError && (
							<div className="mt-6 p-4 bg-red-900/20 border border-red-900/50 rounded-lg">
								<p className="text-red-400">Failed to fetch quote</p>
							</div>
						)}

						{/* Swap Button */}
						{account && quote?.transaction && quote?.requestId && (
							<div className="mt-6">
								<SwapButton
									account={account}
									transaction={quote.transaction}
									requestId={quote.requestId}
								/>
							</div>
						)}
					</div>
				</form>

				{/* Token selection modal */}
				<TokenSelectionModal
					isOpen={selectMode !== null}
					selectMode={selectMode || "input"}
					onClose={() => setSelectMode(null)}
					onSelectToken={(token) => {
						if (selectMode === "input") {
							setInputToken(token);
						} else {
							setOutputToken(token);
						}
						setSelectMode(null);
					}}
					holdings={holdings}
					account={account}
					queryClient={queryClient}
					restoreFocusRef={
						selectMode === "input" ? inputTokenButtonRef : outputTokenButtonRef
					}
				/>
			</div>
		</div>
	);
}
