import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useWalletUiAccount, WalletUiDropdown } from "@wallet-ui/react";
import { ArrowDownUp, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import SwapButton from "../components/SwapButton";
import { getOrder, searchTokens } from "../lib/server-functions";
import type { JupiterOrderResponse, JupiterToken } from "../types/jupiter";

export const Route = createFileRoute("/swap")({
	component: SwapPage,
});

function useDebouncedValue<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const timeoutId = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => clearTimeout(timeoutId);
	}, [value, delay]);

	return debouncedValue;
}

type TokenSelectMode = "input" | "output" | null;

function SwapPage() {
	const [inputToken, setInputToken] = useState<JupiterToken | null>(null);
	const [outputToken, setOutputToken] = useState<JupiterToken | null>(null);
	const [amount, setAmount] = useState("");
	const [selectMode, setSelectMode] = useState<TokenSelectMode>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
	const { account } = useWalletUiAccount();

	// Load default tokens (top 2 from Jupiter)
	const { data: defaultTokens } = useQuery({
		queryKey: ["tokens", "", 2],
		queryFn: () => searchTokens({ data: { query: "", limit: 2 } }),
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

	// Token search query
	const { data: searchResults = [], isFetching: isSearching } = useQuery({
		queryKey: ["tokens", debouncedSearchQuery],
		queryFn: () => searchTokens({ data: { query: debouncedSearchQuery } }),
		enabled: debouncedSearchQuery.trim().length > 0,
		staleTime: 5 * 60 * 1000,
		placeholderData: (previousData, previousQuery) => {
			if (
				previousQuery &&
				debouncedSearchQuery
					.toLowerCase()
					.startsWith(previousQuery.queryKey[1].toLowerCase())
			) {
				return previousData;
			}
			return undefined;
		},
	});

	const displayedResults =
		debouncedSearchQuery.trim().length > 0 ? searchResults : [];

	const handleSelectToken = (token: JupiterToken) => {
		if (selectMode === "input") {
			setInputToken(token);
		} else if (selectMode === "output") {
			setOutputToken(token);
		}
		setSelectMode(null);
		setSearchQuery("");
	};

	const handleSwapTokens = () => {
		const temp = inputToken;
		setInputToken(outputToken);
		setOutputToken(temp);
	};

	// Calculate amount in native units (before decimals)
	const nativeAmount = useMemo(() => {
		if (!amount || !inputToken) return null;
		const amountNum = Number.parseFloat(amount);
		if (Number.isNaN(amountNum) || amountNum <= 0) return null;
		return Math.floor(amountNum * 10 ** inputToken.decimals).toString();
	}, [amount, inputToken]);

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
		queryFn: () => {
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

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white p-8">
			<div className="max-w-2xl mx-auto">
				<div className="flex justify-between items-start mb-8">
					<div>
						<h1 className="text-4xl font-bold mb-2">Swap</h1>
						<p className="text-slate-400">Exchange tokens on Solana</p>
					</div>
					<WalletUiDropdown />
				</div>

				<div className="bg-slate-800 rounded-lg p-6">
					{/* Input Token */}
					<div className="mb-4">
						<div className="block text-sm font-medium mb-2">You Pay</div>
						<div className="flex gap-2">
							<button
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
								className="flex-1 px-4 py-3 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
							/>
						</div>
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
						<div className="block text-sm font-medium mb-2">You Receive</div>
						<div className="flex gap-2">
							<button
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
							<div className="flex-1 px-4 py-3 bg-slate-700 rounded-lg text-slate-400">
								{isLoadingQuote ? (
									<span>Loading...</span>
								) : outputAmount !== null ? (
									<span className="text-white">{outputAmount.toFixed(6)}</span>
								) : (
									<span>0.00</span>
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
										{(
											(Number.parseFloat(quote.outAmount) /
												Number.parseFloat(quote.inAmount)) *
											(10 ** (inputToken?.decimals || 0) /
												10 ** (outputToken?.decimals || 0))
										).toFixed(6)}{" "}
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
										{quote.priceImpact.toFixed(2)}%
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-400">Minimum Received</span>
									<span>
										{(
											Number.parseInt(quote.otherAmountThreshold, 10) /
											10 ** (outputToken?.decimals || 0)
										).toFixed(6)}{" "}
										{outputToken?.symbol}
									</span>
								</div>

								{/* USD Value Summary */}
								<div className="pt-2 mt-2 border-t border-slate-600/50 space-y-2">
									<div className="flex justify-between">
										<span className="text-slate-400">Input Value (USD)</span>
										<span>${quote.inUsdValue.toFixed(2)}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-slate-400">Output Value (USD)</span>
										<span>${quote.outUsdValue.toFixed(2)}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-slate-400">Total Cost</span>
										<span
											className={
												quote.outUsdValue >= quote.inUsdValue
													? "text-green-400"
													: quote.inUsdValue - quote.outUsdValue > 0.1
														? "text-yellow-400"
														: "text-slate-300"
											}
										>
											${(quote.inUsdValue - quote.outUsdValue).toFixed(2)}
										</span>
									</div>
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
					{account && quote?.transaction && (
						<div className="mt-6">
							<SwapButton account={account} transaction={quote.transaction} />
						</div>
					)}
				</div>
			</div>

			{/* Token selection modal */}
			{selectMode && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
					<div className="bg-slate-800 rounded-lg max-w-md w-full max-h-[80vh] flex flex-col">
						<div className="p-4 border-b border-slate-700">
							<div className="flex justify-between items-center mb-4">
								<h2 className="text-xl font-semibold">
									Select {selectMode === "input" ? "Input" : "Output"} Token
								</h2>
								<button
									type="button"
									onClick={() => {
										setSelectMode(null);
										setSearchQuery("");
									}}
									className="text-slate-400 hover:text-white"
								>
									✕
								</button>
							</div>
							<div className="relative">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
								<input
									type="text"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Search for a token"
									className="w-full pl-10 pr-4 py-3 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
								/>
								{isSearching && (
									<div className="absolute right-3 top-1/2 -translate-y-1/2">
										<div className="w-5 h-5 border-2 border-slate-400 border-t-cyan-400 rounded-full animate-spin" />
									</div>
								)}
							</div>
						</div>
						<div className="overflow-y-auto flex-1">
							{displayedResults.length > 0 ? (
								displayedResults.map((token) => (
									<button
										key={token.address}
										type="button"
										onClick={() => handleSelectToken(token)}
										className="w-full flex items-center gap-3 p-4 hover:bg-slate-700 transition-colors text-left"
									>
										{token.logo && (
											<img
												src={token.logo}
												alt={token.symbol}
												className="w-10 h-10 rounded-full"
											/>
										)}
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<span className="font-semibold">{token.symbol}</span>
												{token.isVerified && (
													<span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
														Verified
													</span>
												)}
											</div>
											<div className="text-sm text-slate-400 truncate">
												{token.name}
											</div>
										</div>
									</button>
								))
							) : isSearching ? (
								<div className="p-8 text-center text-slate-400">
									Searching...
								</div>
							) : debouncedSearchQuery.trim() ? (
								<div className="p-8 text-center text-slate-400">
									No tokens found
								</div>
							) : (
								<div className="p-8 text-center text-slate-400">
									Search for a token to get started
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
