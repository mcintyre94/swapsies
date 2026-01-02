import { getBase64Encoder } from "@solana/kit";
import { useSignTransaction } from "@solana/react";
import type { UiWalletAccount } from "@wallet-ui/react";
import { ArrowRightLeft } from "lucide-react";
import { useCallback, useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";

type Props = {
	account: UiWalletAccount;
	transaction: string;
};

function SwapButtonInner({ account, transaction }: Props) {
	const signTransaction = useSignTransaction(account, "solana:mainnet");
	const transactionBytes = useMemo(() => {
		const encoder = getBase64Encoder();
		return encoder.encode(transaction);
	}, [transaction]);

	const handleSwap = useCallback(async () => {
		const signedTransaction = await signTransaction({
			transaction: transactionBytes as Uint8Array,
		});
		console.log("Signed Transaction:", signedTransaction);
	}, [signTransaction, transactionBytes]);

	return (
		<button
			type="button"
			onClick={handleSwap}
			className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98]"
		>
			<ArrowRightLeft className="w-5 h-5" />
			Swap
		</button>
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
