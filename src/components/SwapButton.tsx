import { getBase64Codec } from "@solana/kit";
import { useSignTransaction } from "@solana/react";
import { useQueryClient } from "@tanstack/react-query";
import type { UiWalletAccount } from "@wallet-ui/react";
import {
	AlertCircle,
	ArrowRight,
	ArrowRightLeft,
	CheckCircle2,
	Loader2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { formatTokenAmount } from "@/lib/format";
import { executeSwap } from "@/lib/server-functions";

type Props = {
	account: UiWalletAccount;
	transaction: string;
	requestId: string;
	inputToken: { decimals: number; logo?: string; symbol: string };
	outputToken: { decimals: number; logo?: string; symbol: string };
};

function SwapButtonInner({
	account,
	transaction,
	requestId,
	inputToken,
	outputToken,
}: Props) {
	const signTransaction = useSignTransaction(account, "solana:mainnet");
	const base64Codec = useMemo(() => getBase64Codec(), []);
	const queryClient = useQueryClient();

	const [isExecuting, setIsExecuting] = useState(false);
	const [isWaitingForSignature, setIsWaitingForSignature] = useState(false);
	const [executionError, setExecutionError] = useState<string | null>(null);
	const [executionSuccess, setExecutionSuccess] = useState<{
		signature: string;
		inputAmount: number;
		outputAmount: number;
		inputToken: { logo?: string; symbol: string };
		outputToken: { logo?: string; symbol: string };
	} | null>(null);

	const transactionBytes = useMemo(() => {
		return base64Codec.encode(transaction);
	}, [transaction, base64Codec.encode]);

	const handleSwap = useCallback(async () => {
		try {
			// Clear previous results
			setIsExecuting(true);
			setIsWaitingForSignature(true);
			setExecutionError(null);
			setExecutionSuccess(null);

			// 1. Sign transaction
			const { signedTransaction: signedTransactionBytes } =
				await signTransaction({
					transaction: transactionBytes as Uint8Array,
				});
			const signedTransaction = base64Codec.decode(signedTransactionBytes);

			// Done waiting for signature, now polling
			setIsWaitingForSignature(false);

			// 2. Poll executeSwap every 5 seconds (max 12 attempts = 60s)
			let attempt = 0;
			const maxAttempts = 12;
			const pollInterval = 5000; // 5 seconds

			while (attempt < maxAttempts) {
				attempt++;

				const result = await executeSwap({
					data: { signedTransaction, requestId },
				});

				// Check if response is success (has signature field)
				if ("signature" in result) {
					// SUCCESS!
					const inputAmountUI =
						Number.parseInt(result.inputAmountResult, 10) /
						10 ** inputToken.decimals;
					const outputAmountUI =
						Number.parseInt(result.outputAmountResult, 10) /
						10 ** outputToken.decimals;
					setExecutionSuccess({
						signature: result.signature,
						inputAmount: inputAmountUI,
						outputAmount: outputAmountUI,
						inputToken: {
							logo: inputToken.logo,
							symbol: inputToken.symbol,
						},
						outputToken: {
							logo: outputToken.logo,
							symbol: outputToken.symbol,
						},
					});
					setIsExecuting(false);

					// Refresh wallet balances to show updated amounts
					queryClient.invalidateQueries({ queryKey: ["holdings"] });

					return;
				}

				// Check if response is an error
				if ("error" in result && result.error !== "Transaction not found") {
					// Non-retryable error
					throw new Error(result.error);
				}

				// "Transaction not found" or still processing, wait and retry
				if (attempt < maxAttempts) {
					await new Promise((resolve) => setTimeout(resolve, pollInterval));
				}
			}

			// Timed out after 12 attempts
			throw new Error("Transaction confirmation timed out after 60 seconds");
		} catch (error) {
			// Check if user rejected the signature
			const errorMessage =
				error instanceof Error
					? error.message
					: typeof error === "string"
						? error.toString()
						: "Unknown error";
			const isUserRejection =
				errorMessage.toLowerCase().includes("rejected") ||
				errorMessage.toLowerCase().includes("declined") ||
				errorMessage.toLowerCase().includes("denied") ||
				errorMessage.toLowerCase().includes("cancelled") ||
				errorMessage.toLowerCase().includes("canceled") ||
				(errorMessage.toLowerCase().includes("user") &&
					errorMessage.toLowerCase().includes("abort"));

			setExecutionError(
				isUserRejection ? "Transaction signing was cancelled" : errorMessage,
			);
			setIsExecuting(false);
			setIsWaitingForSignature(false);
		}
	}, [
		signTransaction,
		transactionBytes,
		requestId,
		base64Codec.decode,
		queryClient,
		inputToken,
		outputToken,
	]);

	return (
		<div className="space-y-3">
			<button
				type="button"
				onClick={handleSwap}
				disabled={isExecuting}
				className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-teal-600 hover:from-blue-600 hover:to-teal-700 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
			>
				{isExecuting ? (
					<>
						<Loader2 className="w-5 h-5 animate-spin" />
						{isWaitingForSignature
							? "Waiting for signature..."
							: "Confirming..."}
					</>
				) : (
					<>
						<ArrowRightLeft className="w-5 h-5" />
						Swap
					</>
				)}
			</button>

			{executionSuccess && (
				<output
					className="w-full py-4 px-4 bg-green-900/20 border border-green-900/50 rounded-xl block"
					aria-live="polite"
				>
					<div className="flex items-center justify-center gap-2 text-green-400 font-medium mb-3">
						<CheckCircle2 className="w-5 h-5" aria-hidden="true" />
						<span>Swap successful!</span>
					</div>
					<div className="flex items-center justify-center gap-3 text-sm">
						<div className="flex items-center gap-1.5">
							{executionSuccess.inputToken.logo && (
								<img
									src={executionSuccess.inputToken.logo}
									alt={executionSuccess.inputToken.symbol}
									className="w-5 h-5 rounded-full"
								/>
							)}
							<span className="font-mono">
								{formatTokenAmount(executionSuccess.inputAmount)}{" "}
								{executionSuccess.inputToken.symbol}
							</span>
						</div>
						<ArrowRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
						<div className="flex items-center gap-1.5">
							{executionSuccess.outputToken.logo && (
								<img
									src={executionSuccess.outputToken.logo}
									alt={executionSuccess.outputToken.symbol}
									className="w-5 h-5 rounded-full"
								/>
							)}
							<span className="font-mono">
								{formatTokenAmount(executionSuccess.outputAmount)}{" "}
								{executionSuccess.outputToken.symbol}
							</span>
						</div>
					</div>
					<div className="mt-2 text-center">
						<a
							href={`https://orbmarkets.io/tx/${executionSuccess.signature}`}
							target="_blank"
							rel="noopener noreferrer"
							className="text-green-400/70 hover:text-green-300 text-xs underline"
						>
							View transaction
						</a>
					</div>
				</output>
			)}

			{executionError && (
				<div
					className="w-full py-3 px-4 bg-red-900/20 border border-red-900/50 rounded-xl"
					role="alert"
					aria-live="assertive"
				>
					<p className="text-red-400 font-medium text-center flex items-center justify-center gap-2">
						<AlertCircle className="w-5 h-5" aria-hidden="true" />
						<span>{executionError}</span>
					</p>
				</div>
			)}
		</div>
	);
}

export default function SwapButton(props: Props) {
	return (
		<ErrorBoundary
			resetKeys={[props.account]}
			fallbackRender={() => (
				<div className="w-full py-4 px-6 bg-red-900/20 border border-red-900/50 rounded-xl text-center">
					<p className="text-red-400 font-medium">
						Your wallet doesn't support signing transactions. Please try a
						different wallet.
					</p>
				</div>
			)}
		>
			<SwapButtonInner {...props} />
		</ErrorBoundary>
	);
}
