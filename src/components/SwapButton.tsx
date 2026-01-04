import { getBase64Codec } from "@solana/kit";
import { useSignTransaction } from "@solana/react";
import { useQueryClient } from "@tanstack/react-query";
import type { UiWalletAccount } from "@wallet-ui/react";
import {
	AlertCircle,
	ArrowRightLeft,
	CheckCircle2,
	Loader2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { executeSwap } from "@/lib/server-functions";

type Props = {
	account: UiWalletAccount;
	transaction: string;
	requestId: string;
};

function SwapButtonInner({ account, transaction, requestId }: Props) {
	const signTransaction = useSignTransaction(account, "solana:mainnet");
	const base64Codec = useMemo(() => getBase64Codec(), []);
	const queryClient = useQueryClient();

	const [isExecuting, setIsExecuting] = useState(false);
	const [isWaitingForSignature, setIsWaitingForSignature] = useState(false);
	const [executionError, setExecutionError] = useState<string | null>(null);
	const [executionSuccess, setExecutionSuccess] = useState<{
		signature: string;
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
					setExecutionSuccess({ signature: result.signature });
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
					className="w-full py-3 px-4 bg-green-900/20 border border-green-900/50 rounded-xl block"
					aria-live="polite"
				>
					<p className="text-green-400 font-medium text-center flex items-center justify-center gap-2">
						<CheckCircle2 className="w-5 h-5" aria-hidden="true" />
						<span>
							Swap successful!{" "}
							<a
								href={`https://orbmarkets.io/tx/${executionSuccess.signature}`}
								target="_blank"
								rel="noopener noreferrer"
								className="underline hover:text-green-300"
							>
								View transaction
							</a>
						</span>
					</p>
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
