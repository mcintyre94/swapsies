import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useWalletUiAccount, WalletUiDropdown } from "@wallet-ui/react";
import { ArrowDownUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import SwapButton from "../components/SwapButton";
import TokenSelectionModal from "../components/TokenSelectionModal";
import { getCostBasisForToken } from "../lib/cost-basis";
import { formatNumber, formatTokenAmount, formatUSD } from "../lib/format";
import {
	getOrder,
	getWalletHoldings,
	searchTokens,
} from "../lib/server-functions";
import type { JupiterOrderResponse, JupiterToken } from "../types/jupiter";

export const Route = createFileRoute("/")({
	component: SwapPage,
});

type TokenSelectMode = "input" | "output" | null;

function SwapPage() {
	const queryClient = useQueryClient();
	const [inputToken, setInputToken] = useState<JupiterToken | null>(null);
	const [outputToken, setOutputToken] = useState<JupiterToken | null>(null);
	const [amount, setAmount] = useState("");
	const [selectMode, setSelectMode] = useState<TokenSelectMode>(null);
	const { account } = useWalletUiAccount();
	const inputTokenButtonRef = useRef<HTMLButtonElement>(null);
	const outputTokenButtonRef = useRef<HTMLButtonElement>(null);

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

	// Set default tokens on mount
	useEffect(() => {
		if (
			defaultTokens &&
			defaultTokens.length >= 2 &&
			!inputToken &&
			!outputToken
		) {
			setInputToken(defaultTokens[0]);
			setOutputToken(defaultTokens[1]);
		}
	}, [defaultTokens, inputToken, outputToken]);

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

	// Calculate cost basis metrics
	const costBasisMetrics = useMemo(() => {
		if (!inputTokenCostBasis || !quote || !debouncedAmount) return null;

		const amountNum = Number.parseFloat(debouncedAmount);
		if (Number.isNaN(amountNum) || amountNum <= 0) return null;

		const costBasisPerToken = inputTokenCostBasis.costBasisUSD;
		const totalCostBasis = costBasisPerToken * amountNum;
		const realizedGainLoss = quote.inUsdValue - totalCostBasis;
		const gainLossPercentage = (realizedGainLoss / totalCostBasis) * 100;

		return {
			costBasisPerToken,
			totalCostBasis,
			realizedGainLoss,
			gainLossPercentage,
		};
	}, [inputTokenCostBasis, quote, debouncedAmount]);

	return (
		<div className="min-h-screen p-8">
			<div className="max-w-2xl mx-auto">
				<div className="flex justify-between items-start mb-8">
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
					<div className="bg-slate-800 rounded-lg p-6">
						{/* Input Token */}
						<div className="mb-4">
							<div className="block text-sm font-medium mb-2">Swap your</div>
							<div className="flex gap-2">
								<button
									ref={inputTokenButtonRef}
									type="button"
									onClick={() => setSelectMode("input")}
									className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors min-w-[140px]"
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
									className={`flex-1 px-4 py-3 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 ${
										isAmountExceedingBalance
											? "ring-2 ring-red-500 focus:ring-red-500"
											: "focus:ring-cyan-500"
									}`}
								/>
							</div>
							{account && inputToken && inputTokenBalanceUI !== null && (
								<div className="mt-2 flex items-center justify-between text-sm">
									<div className="text-slate-400">
										Balance: {formatTokenAmount(inputTokenBalanceUI)}{" "}
										{inputToken.symbol}
									</div>
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
									className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors min-w-[140px]"
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
								<div className="mt-6 p-4 bg-slate-700/50 rounded-lg space-y-2 text-sm">
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
												Math.abs(quote.priceImpact) > 0.1
													? "text-yellow-400"
													: "text-green-400"
											}
										>
											{formatNumber(quote.priceImpact, 2)}%
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-slate-400">Minimum Received</span>
										<span>
											{formatTokenAmount(
												Number.parseInt(quote.otherAmountThreshold, 10) /
													10 ** (outputToken?.decimals || 0),
											)}{" "}
											{outputToken?.symbol}
										</span>
									</div>

									{/* USD Value Summary */}
									<div className="pt-2 mt-2 border-t border-slate-600/50 space-y-2">
										<div className="flex justify-between">
											<span className="text-slate-400">Input Value</span>
											<span>{formatUSD(quote.inUsdValue)}</span>
										</div>
										<div className="flex justify-between">
											<span className="text-slate-400">Output Value</span>
											<span>{formatUSD(quote.outUsdValue)}</span>
										</div>
										<div className="flex justify-between">
											<span className="text-slate-400">Estimated Cost</span>
											<span
												className={
													quote.outUsdValue >= quote.inUsdValue
														? "text-green-400"
														: quote.inUsdValue - quote.outUsdValue > 0.1
															? "text-yellow-400"
															: "text-slate-300"
												}
											>
												{formatUSD(quote.inUsdValue - quote.outUsdValue)}
											</span>
										</div>
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
