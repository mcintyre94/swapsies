import { type QueryClient, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCostBasisForToken } from "../lib/cost-basis";
import { formatTokenAmount, formatUSD } from "../lib/format";
import { batchSearchTokens, searchTokens } from "../lib/server-functions";
import type { JupiterToken } from "../types/jupiter";

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

interface TokenSelectionModalProps {
	// Control
	isOpen: boolean;
	selectMode: "input" | "output";
	onClose: () => void;
	onSelectToken: (token: JupiterToken) => void;
	restoreFocusRef?: React.RefObject<HTMLElement | null>;

	// Data
	holdings: Array<{ mintAddress: string; amount: bigint }>;
	account: { address: string } | null | undefined;

	// Dependencies
	queryClient: QueryClient;
}

export default function TokenSelectionModal({
	isOpen,
	selectMode,
	onClose,
	onSelectToken,
	restoreFocusRef,
	holdings,
	account,
	queryClient,
}: TokenSelectionModalProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
	const [selectedTokenIndex, setSelectedTokenIndex] = useState(0);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const selectedTokenRef = useRef<HTMLButtonElement>(null);
	const savedRestoreFocusRef = useRef<
		React.RefObject<HTMLElement | null> | undefined
	>(undefined);

	// Create a lookup map for fast balance retrieval
	const holdingsMap = useMemo(() => {
		const map = new Map();
		for (const holding of holdings) {
			map.set(holding.mintAddress, holding.amount);
		}
		return map;
	}, [holdings]);

	// Fetch metadata for wallet holdings to display when search is empty
	const holdingMintAddresses = useMemo(
		() => holdings.map((h) => h.mintAddress),
		[holdings],
	);

	const { data: holdingsWithMetadata = [], isLoading: isLoadingHoldings } =
		useQuery({
			queryKey: ["holdings-metadata", account?.address, holdingMintAddresses],
			queryFn: async ({ signal }) => {
				// Filter non-zero holdings
				const nonZeroHoldings = holdings.filter((h) => h.amount > 0n);

				if (nonZeroHoldings.length === 0) return [];

				const mintAddresses = nonZeroHoldings.map((h) => h.mintAddress);

				// Fetch metadata in chunks of 100 (Jupiter API limit)
				const BATCH_SIZE = 100;
				const tokens = [];
				for (let i = 0; i < mintAddresses.length; i += BATCH_SIZE) {
					const chunk = mintAddresses.slice(i, i + BATCH_SIZE);
					const result = await batchSearchTokens({
						data: { mintAddresses: chunk },
						signal,
					});
					tokens.push(...result);
				}

				// Enrich with holding data and calculate USD values
				const enriched = tokens
					.map((token) => {
						const holding = nonZeroHoldings.find(
							(h) => h.mintAddress === token.address,
						);
						if (!holding) return null;

						const balance = Number(holding.amount) / 10 ** token.decimals;
						const usdValue = token.usdPrice ? token.usdPrice * balance : 0;

						return {
							token,
							balance,
							usdValue,
						};
					})
					.filter((item): item is NonNullable<typeof item> => item !== null);

				// Sort by USD value descending
				enriched.sort((a, b) => b.usdValue - a.usdValue);

				// Return top 20
				return enriched.slice(0, 20);
			},
			enabled: !!account?.address && holdings.length > 0,
			staleTime: 30 * 1000, // 30 seconds to match holdings cache
		});

	// Token search query
	const { data: searchResults = [], isFetching: isSearching } = useQuery({
		queryKey: ["tokens", debouncedSearchQuery],
		queryFn: ({ signal }) =>
			searchTokens({ data: { query: debouncedSearchQuery }, signal }),
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

	const displayedResults = useMemo(() => {
		// Search is active - show search results
		if (debouncedSearchQuery.trim().length > 0) {
			return searchResults;
		}

		// No search - show holdings
		if (holdingsWithMetadata && holdingsWithMetadata.length > 0) {
			return holdingsWithMetadata.map((h) => h.token);
		}

		// Default: empty
		return [];
	}, [debouncedSearchQuery, searchResults, holdingsWithMetadata]);

	// Calculate display data for a token in the selection list
	const getTokenDisplayData = useCallback(
		(token: JupiterToken) => {
			// Get balance if available
			const nativeBalance = holdingsMap.get(token.address);
			const balance =
				nativeBalance !== undefined
					? Number(nativeBalance) / 10 ** token.decimals
					: null;

			// Calculate USD value if we have balance and price
			const usdValue =
				balance !== null && balance > 0 && token.usdPrice
					? token.usdPrice * balance
					: null;

			// Get cost basis if available (only check if we have balance)
			const costBasis =
				balance !== null && balance > 0
					? getCostBasisForToken(token.address)
					: null;

			// Calculate gain/loss if we have all required data
			let gainLoss: number | null = null;
			if (balance !== null && balance > 0 && costBasis && token.usdPrice) {
				const currentValue = token.usdPrice * balance;
				const costBasisValue = costBasis.costBasisUSD * balance;
				gainLoss = currentValue - costBasisValue;
			}

			return { balance, usdValue, costBasis, gainLoss };
		},
		[holdingsMap],
	);

	const handleCloseModal = useCallback(() => {
		setSearchQuery("");
		setSelectedTokenIndex(0);
		queryClient.cancelQueries({ queryKey: ["holdings-metadata"] });
		onClose();
	}, [queryClient, onClose]);

	const handleSelectToken = (token: JupiterToken) => {
		onSelectToken(token);
		setSearchQuery("");
		setSelectedTokenIndex(0);
	};

	// Handle keyboard navigation in token list
	const handleTokenListKeyDown = (event: React.KeyboardEvent) => {
		if (displayedResults.length === 0) return;

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				setSelectedTokenIndex((prev) =>
					prev < displayedResults.length - 1 ? prev + 1 : prev,
				);
				break;
			case "ArrowUp":
				event.preventDefault();
				setSelectedTokenIndex((prev) => (prev > 0 ? prev - 1 : prev));
				break;
			case "Enter":
				event.preventDefault();
				if (displayedResults[selectedTokenIndex]) {
					handleSelectToken(displayedResults[selectedTokenIndex]);
				}
				break;
		}
	};

	// Auto-focus search input when modal opens and save the restore focus ref
	useEffect(() => {
		if (isOpen) {
			// Save the focus ref when modal opens
			savedRestoreFocusRef.current = restoreFocusRef;
			searchInputRef.current?.focus();
		} else if (savedRestoreFocusRef.current?.current) {
			// Restore focus when modal closes using the saved ref
			setTimeout(() => {
				savedRestoreFocusRef.current?.current?.focus();
			}, 0);
		}
	}, [isOpen, restoreFocusRef]);

	// Handle Escape key to close modal
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				handleCloseModal();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, handleCloseModal]);

	// Scroll selected token into view when navigating with keyboard
	// biome-ignore lint/correctness/useExhaustiveDependencies: need to scroll when selectedTokenIndex changes
	useEffect(() => {
		if (isOpen && selectedTokenRef.current) {
			selectedTokenRef.current.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			});
		}
	}, [selectedTokenIndex, isOpen]);

	if (!isOpen) return null;

	return (
		// biome-ignore lint/a11y/useSemanticElements: Modal overlay is not a semantic button - click-away is a common UX pattern
		<div
			className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
			onClick={(e) => {
				if (e.target === e.currentTarget) {
					handleCloseModal();
				}
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" && e.target === e.currentTarget) {
					handleCloseModal();
				}
			}}
			role="button"
			tabIndex={-1}
		>
			<div className="bg-slate-800 rounded-lg max-w-md w-full max-h-[80vh] flex flex-col">
				<div className="p-4 border-b border-slate-700">
					<div className="flex justify-between items-center mb-4">
						<h2 className="text-xl font-semibold">
							Select {selectMode === "input" ? "Input" : "Output"} Token
						</h2>
						<button
							type="button"
							onClick={handleCloseModal}
							className="text-slate-400 hover:text-white"
						>
							✕
						</button>
					</div>
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
						<input
							ref={searchInputRef}
							type="text"
							value={searchQuery}
							onChange={(e) => {
								setSearchQuery(e.target.value);
								setSelectedTokenIndex(0);
							}}
							onKeyDown={handleTokenListKeyDown}
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
						displayedResults.map((token, index) => {
							const { balance, usdValue, gainLoss } =
								getTokenDisplayData(token);

							return (
								<button
									key={token.address}
									ref={index === selectedTokenIndex ? selectedTokenRef : null}
									type="button"
									onClick={() => handleSelectToken(token)}
									className={`w-full flex items-center gap-3 p-4 transition-colors text-left ${
										index === selectedTokenIndex
											? "bg-slate-700"
											: "hover:bg-slate-700"
									}`}
								>
									{token.logo ? (
										<img
											src={token.logo}
											alt={token.symbol}
											className="w-10 h-10 rounded-full flex-shrink-0"
										/>
									) : (
										<div className="w-10 h-10 rounded-full bg-slate-600 flex-shrink-0" />
									)}
									<div className="flex-1 min-w-0">
										{/* Top row: Symbol and verified badge */}
										<div className="flex items-center gap-2 mb-1">
											<span className="font-semibold">{token.symbol}</span>
											{token.isVerified && (
												<span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
													Verified
												</span>
											)}
										</div>

										{/* Second row: Token name */}
										<div className="text-sm text-slate-400 truncate mb-1">
											{token.name}
										</div>

										{/* Third row: Balance (if wallet connected and has balance) */}
										{balance !== null && balance > 0 && (
											<div className="text-sm text-slate-300">
												Balance: {formatTokenAmount(balance)}
												{usdValue !== null && (
													<span className="text-slate-400">
														{" "}
														({formatUSD(usdValue)})
													</span>
												)}
											</div>
										)}
									</div>

									{/* Right column: Gain/Loss (if available, only for input token) */}
									{selectMode === "input" && gainLoss !== null && (
										<div className="text-right flex-shrink-0">
											<div
												className={`text-sm font-medium ${
													gainLoss >= 0 ? "text-green-400" : "text-red-400"
												}`}
											>
												{gainLoss >= 0 ? "+" : ""}
												{formatUSD(gainLoss)}
											</div>
											<div className="text-xs text-slate-400">Est max P/L</div>
										</div>
									)}
								</button>
							);
						})
					) : isSearching || isLoadingHoldings ? (
						<div className="p-8 text-center text-slate-400">
							<div className="flex flex-col items-center gap-3">
								<div className="w-8 h-8 border-2 border-slate-400 border-t-cyan-400 rounded-full animate-spin" />
								<span>
									{isSearching ? "Searching..." : "Loading your holdings..."}
								</span>
							</div>
						</div>
					) : debouncedSearchQuery.trim() ? (
						<div className="p-8 text-center text-slate-400">
							No tokens found
						</div>
					) : selectMode === "input" && account ? (
						<div className="p-8 text-center text-slate-400">
							{holdings.length === 0
								? "No holdings found. Search for a token to get started."
								: "No significant holdings found. Try searching for a token."}
						</div>
					) : (
						<div className="p-8 text-center text-slate-400">
							Search for a token to get started
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
