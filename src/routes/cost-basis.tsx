import { createFileRoute } from "@tanstack/react-router";
import { Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/cost-basis")({
	component: CostBasisPage,
});

interface JupiterToken {
	address: string;
	name: string;
	symbol: string;
	logo?: string;
	decimals: number;
	tags?: string[];
	isVerified?: boolean;
}

interface StoredCostBasis {
	tokenAddress: string;
	costBasisUSD: number;
	tokenName: string;
	tokenSymbol: string;
	tokenLogo?: string;
}

type InputMode = "per-token" | "total";

function CostBasisPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<JupiterToken[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [selectedToken, setSelectedToken] = useState<JupiterToken | null>(null);
	const [inputMode, setInputMode] = useState<InputMode>("per-token");
	const [lastSearchTime, setLastSearchTime] = useState(0);

	const [costBasisPerToken, setCostBasisPerToken] = useState("");
	const [totalBalance, setTotalBalance] = useState("");
	const [totalCost, setTotalCost] = useState("");
	const [savedCostBasis, setSavedCostBasis] = useState<StoredCostBasis[]>([]);

	const loadSavedCostBasis = useCallback(() => {
		const existingData = localStorage.getItem("costBasisData");
		if (existingData) {
			const costBasisData = JSON.parse(existingData);
			const entries = Object.values(costBasisData) as StoredCostBasis[];
			setSavedCostBasis(entries);
		}
	}, []);

	useEffect(() => {
		loadSavedCostBasis();
	}, [loadSavedCostBasis]);

	const handleSearch = async (query: string) => {
		if (!query.trim()) {
			setSearchResults([]);
			return;
		}

		const now = Date.now();
		const timeSinceLastSearch = now - lastSearchTime;
		if (timeSinceLastSearch < 1000) {
			setTimeout(() => handleSearch(query), 1000 - timeSinceLastSearch);
			return;
		}

		setIsSearching(true);
		setLastSearchTime(now);

		try {
			const response = await fetch(
				`/api/tokens/search?query=${encodeURIComponent(query)}`,
			);
			if (response.ok) {
				const tokens: JupiterToken[] = await response.json();
				setSearchResults(tokens);
			} else {
				console.error("Search failed:", response.statusText);
				setSearchResults([]);
			}
		} catch (error) {
			console.error("Search error:", error);
			setSearchResults([]);
		} finally {
			setIsSearching(false);
		}
	};

	const handleSelectToken = (token: JupiterToken) => {
		setSelectedToken(token);
		setSearchQuery("");
		setSearchResults([]);
	};

	const calculateCostBasisPerToken = (): number | null => {
		if (inputMode === "per-token") {
			const value = Number.parseFloat(costBasisPerToken);
			return Number.isNaN(value) ? null : value;
		}
		const balance = Number.parseFloat(totalBalance);
		const cost = Number.parseFloat(totalCost);
		if (Number.isNaN(balance) || Number.isNaN(cost) || balance === 0)
			return null;
		return cost / balance;
	};

	const handleSave = () => {
		if (!selectedToken) return;

		const costBasis = calculateCostBasisPerToken();
		if (costBasis === null) return;

		const existingData = localStorage.getItem("costBasisData");
		const costBasisData = existingData ? JSON.parse(existingData) : {};

		costBasisData[selectedToken.address] = {
			tokenAddress: selectedToken.address,
			costBasisUSD: costBasis,
			tokenName: selectedToken.name,
			tokenSymbol: selectedToken.symbol,
			tokenLogo: selectedToken.logo,
		};

		localStorage.setItem("costBasisData", JSON.stringify(costBasisData));

		setSelectedToken(null);
		setCostBasisPerToken("");
		setTotalBalance("");
		setTotalCost("");
		loadSavedCostBasis();
	};

	const handleDelete = (tokenAddress: string) => {
		const existingData = localStorage.getItem("costBasisData");
		if (!existingData) return;

		const costBasisData = JSON.parse(existingData);
		delete costBasisData[tokenAddress];
		localStorage.setItem("costBasisData", JSON.stringify(costBasisData));
		loadSavedCostBasis();
	};

	const calculatedCostBasis = calculateCostBasisPerToken();

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white p-8">
			<div className="max-w-4xl mx-auto">
				<h1 className="text-4xl font-bold mb-2">Cost Basis</h1>
				<p className="text-slate-400 mb-8">
					Enter cost basis data from your tax software
				</p>

				{savedCostBasis.length > 0 && (
					<div className="bg-slate-800 rounded-lg p-6 mb-8">
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
													{entry.tokenLogo && (
														<img
															src={entry.tokenLogo}
															alt={entry.tokenSymbol}
															className="w-8 h-8 rounded-full"
														/>
													)}
													<div>
														<div className="font-semibold">
															{entry.tokenSymbol}
														</div>
														<div className="text-sm text-slate-400">
															{entry.tokenName}
														</div>
													</div>
												</div>
											</td>
											<td className="py-3 px-2 text-right font-mono">
												${entry.costBasisUSD.toFixed(6)}
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

				<div className="bg-slate-800 rounded-lg p-6 mb-6">
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
								<div className="font-semibold">{selectedToken.name}</div>
								<div className="text-sm text-slate-400">
									{selectedToken.symbol}
								</div>
							</div>
							<button
								type="button"
								onClick={() => setSelectedToken(null)}
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
									type="text"
									value={searchQuery}
									onChange={(e) => {
										setSearchQuery(e.target.value);
										handleSearch(e.target.value);
									}}
									placeholder="Search for a token (e.g., SOL, USDC)"
									className="w-full pl-10 pr-4 py-3 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
								/>
							</div>

							{searchResults.length > 0 && (
								<div className="absolute z-10 w-full mt-2 bg-slate-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
									{searchResults.map((token) => (
										<button
											key={token.address}
											type="button"
											onClick={() => handleSelectToken(token)}
											className="w-full flex items-center gap-3 p-3 hover:bg-slate-600 transition-colors text-left"
										>
											{token.logo && (
												<img
													src={token.logo}
													alt={token.symbol}
													className="w-8 h-8 rounded-full"
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
									))}
								</div>
							)}

							{isSearching && (
								<div className="text-sm text-slate-400 mt-2">Searching...</div>
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
								onClick={() => setInputMode("per-token")}
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
								onClick={() => setInputMode("total")}
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
									${calculatedCostBasis.toFixed(6)}
								</div>
							</div>
						)}
					</div>
				)}

				<button
					type="button"
					onClick={handleSave}
					disabled={!selectedToken || calculatedCostBasis === null}
					className="w-full py-4 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
				>
					Save Cost Basis
				</button>
			</div>
		</div>
	);
}
