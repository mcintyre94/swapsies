import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Loader2, Search, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
	getCostBasisData,
	type StoredCostBasis,
	saveCostBasisData,
} from "../lib/cost-basis";
import { generateCostBasisCSV, parseCostBasisCSV } from "../lib/csv";
import { formatUSD } from "../lib/format";
import { batchSearchTokens, searchTokens } from "../lib/server-functions";
import { validateAddresses } from "../lib/validation";
import type { JupiterToken } from "../types/jupiter";

export const Route = createFileRoute("/cost-basis")({
	component: CostBasisPage,
});

type InputMode = "per-token" | "total";

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

function CostBasisPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
	const [selectedToken, setSelectedToken] = useState<JupiterToken | null>(null);
	const [inputMode, setInputMode] = useState<InputMode>("per-token");
	const [selectedTokenIndex, setSelectedTokenIndex] = useState(0);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const [shouldFocusSearch, setShouldFocusSearch] = useState(false);

	const [costBasisPerToken, setCostBasisPerToken] = useState("");
	const [totalBalance, setTotalBalance] = useState("");
	const [totalCost, setTotalCost] = useState("");
	const [savedCostBasis, setSavedCostBasis] = useState<StoredCostBasis[]>([]);

	// Import state management
	const [isImporting, setIsImporting] = useState(false);
	const [importProgress, setImportProgress] = useState<{
		current: number;
		total: number;
	} | null>(null);
	const [importError, setImportError] = useState<string | null>(null);

	// Load saved cost basis data on mount (runs before paint)
	useLayoutEffect(() => {
		const costBasisData = getCostBasisData();
		const entries = Object.values(costBasisData) as StoredCostBasis[];
		setSavedCostBasis(entries);
	}, []);

	// Focus search input after saving (when selectedToken becomes null and flag is set)
	useEffect(() => {
		if (shouldFocusSearch && !selectedToken) {
			searchInputRef.current?.focus();
			setShouldFocusSearch(false);
		}
	}, [shouldFocusSearch, selectedToken]);

	// Use TanStack Query for token search
	const { data: searchResults = [], isFetching: isSearching } = useQuery({
		queryKey: ["tokens", debouncedSearchQuery],
		queryFn: ({ signal }) =>
			searchTokens({ data: { query: debouncedSearchQuery }, signal }),
		enabled: debouncedSearchQuery.trim().length > 0,
		staleTime: 5 * 60 * 1000, // 5 minutes
		placeholderData: (previousData, previousQuery) => {
			// Only keep previous data if the new query starts with the old query
			// (i.e., user is refining their search, not starting fresh)
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

	const handleSelectToken = (token: JupiterToken) => {
		setSelectedToken(token);
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

	const handleModeChange = (mode: InputMode) => {
		setInputMode(mode);
		// Clear fields when switching modes to prevent stale calculations
		setCostBasisPerToken("");
		setTotalBalance("");
		setTotalCost("");
	};

	// Clear search results when query is empty
	const displayedResults =
		debouncedSearchQuery.trim().length > 0 ? searchResults : [];

	// Memoize the cost basis calculation
	const calculatedCostBasis = useMemo((): number | null => {
		if (inputMode === "per-token") {
			const value = Number.parseFloat(costBasisPerToken);
			return Number.isNaN(value) ? null : value;
		}
		const balance = Number.parseFloat(totalBalance);
		const cost = Number.parseFloat(totalCost);
		if (Number.isNaN(balance) || Number.isNaN(cost) || balance === 0)
			return null;
		return cost / balance;
	}, [inputMode, costBasisPerToken, totalBalance, totalCost]);

	const handleFormSubmit = (e: React.FormEvent) => {
		e.preventDefault(); // Prevent page reload
		handleSave(); // Call existing save logic
	};

	const handleSave = () => {
		if (!selectedToken || calculatedCostBasis === null) return;

		const costBasisData = getCostBasisData();

		costBasisData[selectedToken.address] = {
			tokenAddress: selectedToken.address,
			costBasisUSD: calculatedCostBasis,
			tokenName: selectedToken.name,
			tokenSymbol: selectedToken.symbol,
			tokenLogo: selectedToken.logo,
			isVerified: selectedToken.isVerified,
		};

		const success = saveCostBasisData(costBasisData);

		if (success) {
			// Reset form
			setSelectedToken(null);
			setCostBasisPerToken("");
			setTotalBalance("");
			setTotalCost("");

			// Reload saved data
			const updatedData = getCostBasisData();
			const entries = Object.values(updatedData) as StoredCostBasis[];
			setSavedCostBasis(entries);

			// Trigger focus on search input after re-render
			setShouldFocusSearch(true);
		}
	};

	const handleDelete = (tokenAddress: string) => {
		const costBasisData = getCostBasisData();
		delete costBasisData[tokenAddress];

		const success = saveCostBasisData(costBasisData);

		if (success) {
			// Reload saved data
			const updatedData = getCostBasisData();
			const entries = Object.values(updatedData) as StoredCostBasis[];
			setSavedCostBasis(entries);
		}
	};

	const handleExport = () => {
		const costBasisData = getCostBasisData();

		// Transform to minimal format: { mint: costBasis, ... }
		const minimalData: Record<string, number> = {};
		for (const [address, entry] of Object.entries(costBasisData)) {
			minimalData[address] = entry.costBasisUSD;
		}

		const csvContent = generateCostBasisCSV(minimalData);
		const blob = new Blob([csvContent], { type: "text/csv" });
		const url = URL.createObjectURL(blob);

		const link = document.createElement("a");
		link.href = url;
		link.download = `cost-basis-${new Date().toISOString().split("T")[0]}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		// Reset state
		setIsImporting(true);
		setImportError(null);
		setImportProgress(null);

		const reader = new FileReader();

		reader.onload = async (e) => {
			try {
				const content = e.target?.result as string;

				// Parse CSV content (includes validation of cost basis values)
				const costBasisMap = parseCostBasisCSV(content);

				// Extract mint addresses
				const mintAddresses = Object.keys(costBasisMap);

				// Validate mint addresses are valid Solana addresses
				const { valid: validAddresses, invalid: invalidAddresses } =
					validateAddresses(mintAddresses);
				if (invalidAddresses.length > 0) {
					throw new Error(
						`Invalid Solana addresses found: ${invalidAddresses.slice(0, 3).join(", ")}${invalidAddresses.length > 3 ? "..." : ""}`,
					);
				}

				setImportProgress({ current: 0, total: validAddresses.length });

				// Batch fetch in chunks of 100
				const BATCH_SIZE = 100;
				const batches: string[][] = [];
				for (let i = 0; i < validAddresses.length; i += BATCH_SIZE) {
					batches.push(validAddresses.slice(i, i + BATCH_SIZE));
				}

				// Fetch all batches
				const allTokens: JupiterToken[] = [];
				for (let i = 0; i < batches.length; i++) {
					const batch = batches[i];
					const tokens = await batchSearchTokens({
						data: { mintAddresses: batch },
					});
					allTokens.push(...tokens);
					setImportProgress({
						current: Math.min((i + 1) * BATCH_SIZE, mintAddresses.length),
						total: mintAddresses.length,
					});
				}

				// Create token lookup map
				const tokenMap = new Map<string, JupiterToken>();
				for (const token of allTokens) {
					tokenMap.set(token.address, token);
				}

				// Reconstruct full StoredCostBasis objects
				const reconstructedData: Record<string, StoredCostBasis> = {};
				const missingTokens: string[] = [];

				for (const [mintAddress, costBasis] of Object.entries(costBasisMap)) {
					const token = tokenMap.get(mintAddress);

					if (token) {
						reconstructedData[mintAddress] = {
							tokenAddress: mintAddress,
							costBasisUSD: costBasis,
							tokenName: token.name,
							tokenSymbol: token.symbol,
							tokenLogo: token.logo,
							isVerified: token.isVerified,
						};
					} else {
						// Token not found in Jupiter - save with placeholder metadata
						missingTokens.push(mintAddress);
						reconstructedData[mintAddress] = {
							tokenAddress: mintAddress,
							costBasisUSD: costBasis,
							tokenName: "Unknown Token",
							tokenSymbol: "???",
							tokenLogo: undefined,
						};
					}
				}

				// Save reconstructed data
				const success = saveCostBasisData(reconstructedData);

				if (success) {
					const updatedData = getCostBasisData();
					const entries = Object.values(updatedData) as StoredCostBasis[];
					setSavedCostBasis(entries);

					// Show warning if some tokens were missing
					if (missingTokens.length > 0) {
						setImportError(
							`Import successful, but ${missingTokens.length} token${missingTokens.length > 1 ? "s" : ""} could not be found in Jupiter API. They will be shown as "Unknown Token".`,
						);
					}
				}

				setIsImporting(false);
				setImportProgress(null);
			} catch (error) {
				console.error("Failed to import data:", error);
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				setImportError(`Failed to import: ${errorMessage}`);
				setIsImporting(false);
				setImportProgress(null);
			}
		};

		reader.readAsText(file);

		// Reset the input so the same file can be imported again
		event.target.value = "";
	};

	return (
		<div className="min-h-screen p-4 sm:p-8">
			<div className="max-w-4xl mx-auto">
				<div className="flex items-center justify-between mb-2">
					<h1 className="text-4xl font-bold">Cost Basis</h1>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={handleExport}
							disabled={savedCostBasis.length === 0}
							className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
						>
							Export
						</button>
						<label
							className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
								isImporting
									? "bg-slate-800 text-slate-600 cursor-not-allowed"
									: "bg-slate-700 hover:bg-slate-600 cursor-pointer"
							}`}
						>
							{isImporting ? (
								<span className="flex items-center gap-2">
									<Loader2 className="w-4 h-4 animate-spin" />
									Importing...
								</span>
							) : (
								"Import"
							)}
							<input
								type="file"
								accept=".csv"
								onChange={handleImport}
								disabled={isImporting}
								className="hidden"
							/>
						</label>
					</div>
				</div>
				<p className="text-slate-400 mb-8">
					Enter cost basis data from your tax software
				</p>

				{importProgress && (
					<div className="mb-6 p-4 bg-slate-800 rounded-lg">
						<p className="text-sm text-slate-400 mb-2">
							Fetching token metadata: {importProgress.current} /{" "}
							{importProgress.total}
						</p>
						<div className="w-full bg-slate-700 rounded-full h-2">
							<div
								className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
								style={{
									width: `${(importProgress.current / importProgress.total) * 100}%`,
								}}
							/>
						</div>
					</div>
				)}

				{importError && (
					<div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-900/50 rounded-lg">
						<p className="text-yellow-400 text-sm">{importError}</p>
					</div>
				)}

				{savedCostBasis.length > 0 && (
					<div className="bg-slate-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-8">
						<h2 className="text-xl font-semibold mb-4">Saved</h2>
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead>
									<tr className="border-b border-slate-700">
										<th className="text-left py-3 px-2 text-sm font-medium text-slate-400">
											Token
										</th>
										<th className="text-right py-3 px-2 text-sm font-medium text-slate-400">
											Cost Basis
										</th>
										<th className="text-right py-3 px-2 text-sm font-medium text-slate-400">
											Actions
										</th>
									</tr>
								</thead>
								<tbody>
									{savedCostBasis.map((entry) => (
										<tr
											key={entry.tokenAddress}
											className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
										>
											<td className="py-3 px-2">
												<div className="flex items-center gap-3">
													{entry.tokenLogo ? (
														<img
															src={entry.tokenLogo}
															alt={entry.tokenSymbol}
															className="w-8 h-8 rounded-full flex-shrink-0"
														/>
													) : (
														<div className="w-8 h-8 rounded-full bg-slate-600 flex-shrink-0" />
													)}
													<div>
														<div className="flex items-center gap-2">
															<a
																href={`https://orbmarkets.io/address/${entry.tokenAddress}`}
																target="_blank"
																rel="noopener noreferrer"
																className="font-semibold hover:text-cyan-400 transition-colors flex items-center gap-1"
															>
																{entry.tokenSymbol}
																<ExternalLink className="w-3 h-3" />
															</a>
															{entry.isVerified && (
																<span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
																	Verified
																</span>
															)}
														</div>
														<div className="text-sm text-slate-400">
															{entry.tokenName}
														</div>
													</div>
												</div>
											</td>
											<td className="py-3 px-2 text-right font-mono">
												{formatUSD(entry.costBasisUSD, 6)}
											</td>
											<td className="py-3 px-2 text-right">
												<button
													type="button"
													onClick={() => handleDelete(entry.tokenAddress)}
													className="text-slate-400 hover:text-red-400 transition-colors p-2"
													title="Delete"
												>
													<Trash2 className="w-4 h-4" />
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}

				<h2 className="text-2xl font-semibold mb-4">Add New</h2>

				<form onSubmit={handleFormSubmit} noValidate>
					<div className="bg-slate-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
						<div className="block text-sm font-medium mb-2">Select Token</div>

						{selectedToken ? (
							<div className="flex items-center gap-3 p-4 bg-slate-700 rounded-lg">
								{selectedToken.logo && (
									<img
										src={selectedToken.logo}
										alt={selectedToken.symbol}
										className="w-10 h-10 rounded-full"
									/>
								)}
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<div className="font-semibold">{selectedToken.name}</div>
										{selectedToken.isVerified && (
											<span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
												Verified
											</span>
										)}
									</div>
									<div className="text-sm text-slate-400">
										{selectedToken.symbol}
									</div>
								</div>
								<button
									type="button"
									onClick={() => {
										setSelectedToken(null);
										setShouldFocusSearch(true);
									}}
									className="text-slate-400 hover:text-white"
								>
									Change
								</button>
							</div>
						) : (
							<div className="relative">
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
										placeholder="Search for a token (e.g., SOL, USDC)"
										className="w-full pl-10 pr-4 py-3 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
									/>
									{isSearching && (
										<div className="absolute right-3 top-1/2 -translate-y-1/2">
											<div className="w-5 h-5 border-2 border-slate-400 border-t-cyan-400 rounded-full animate-spin" />
										</div>
									)}
								</div>

								{(displayedResults.length > 0 || isSearching) &&
									debouncedSearchQuery.trim() && (
										<div className="absolute z-10 w-full mt-2 bg-slate-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
											{displayedResults.length > 0 ? (
												displayedResults.map((token, index) => (
													<button
														key={token.address}
														type="button"
														onClick={() => handleSelectToken(token)}
														className={`w-full flex items-center gap-3 p-3 transition-colors text-left ${
															index === selectedTokenIndex
																? "bg-slate-600"
																: "hover:bg-slate-600"
														}`}
													>
														{token.logo ? (
															<img
																src={token.logo}
																alt={token.symbol}
																className="w-8 h-8 rounded-full flex-shrink-0"
															/>
														) : (
															<div className="w-8 h-8 rounded-full bg-slate-600 flex-shrink-0" />
														)}
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2">
																<span className="font-semibold">
																	{token.symbol}
																</span>
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
												<div className="p-4 text-center text-slate-400">
													Searching...
												</div>
											) : null}
										</div>
									)}
							</div>
						)}
					</div>

					{selectedToken && (
						<div className="bg-slate-800 rounded-lg p-6 mb-6">
							<div className="block text-sm font-medium mb-4">
								Enter Cost Basis
							</div>

							<div className="flex gap-2 mb-6">
								<button
									type="button"
									onClick={() => handleModeChange("per-token")}
									className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
										inputMode === "per-token"
											? "bg-cyan-500 text-white"
											: "bg-slate-700 text-slate-400 hover:text-white"
									}`}
								>
									Cost Per Token
								</button>
								<button
									type="button"
									onClick={() => handleModeChange("total")}
									className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
										inputMode === "total"
											? "bg-cyan-500 text-white"
											: "bg-slate-700 text-slate-400 hover:text-white"
									}`}
								>
									Total Balance + Cost
								</button>
							</div>

							{inputMode === "per-token" ? (
								<div>
									<label
										htmlFor="cost-basis-input"
										className="block text-sm text-slate-400 mb-2"
									>
										Cost Basis Per Token (USD)
									</label>
									<input
										id="cost-basis-input"
										type="number"
										step="any"
										value={costBasisPerToken}
										onChange={(e) => setCostBasisPerToken(e.target.value)}
										onWheel={(e) => e.currentTarget.blur()}
										placeholder="0.00"
										className="w-full px-4 py-3 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
									/>
								</div>
							) : (
								<div className="space-y-4">
									<div>
										<label
											htmlFor="total-balance-input"
											className="block text-sm text-slate-400 mb-2"
										>
											Total Balance ({selectedToken.symbol})
										</label>
										<input
											id="total-balance-input"
											type="number"
											step="any"
											value={totalBalance}
											onChange={(e) => setTotalBalance(e.target.value)}
											onWheel={(e) => e.currentTarget.blur()}
											placeholder="0.00"
											className="w-full px-4 py-3 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
										/>
									</div>
									<div>
										<label
											htmlFor="total-cost-input"
											className="block text-sm text-slate-400 mb-2"
										>
											Total Cost (USD)
										</label>
										<input
											id="total-cost-input"
											type="number"
											step="any"
											value={totalCost}
											onChange={(e) => setTotalCost(e.target.value)}
											onWheel={(e) => e.currentTarget.blur()}
											placeholder="0.00"
											className="w-full px-4 py-3 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
										/>
									</div>
								</div>
							)}

							{calculatedCostBasis !== null && (
								<div className="mt-4 p-4 bg-slate-700 rounded-lg">
									<div className="text-sm text-slate-400 mb-1">
										Cost Basis Per Token
									</div>
									<div className="text-2xl font-bold text-cyan-400">
										{formatUSD(calculatedCostBasis, 6)}
									</div>
								</div>
							)}
						</div>
					)}

					<button
						type="submit"
						disabled={!selectedToken || calculatedCostBasis === null}
						className="w-full py-4 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
					>
						Save Cost Basis
					</button>
				</form>
			</div>
		</div>
	);
}
