import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import {
	createSolanaDevnet,
	createWalletUiConfig,
	WalletUi,
} from "@wallet-ui/react";
import { useMemo, useState } from "react";

import Header from "../components/Header";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "TanStack Start Starter",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 60 * 1000, // 1 minute default
						gcTime: 5 * 60 * 1000, // 5 minutes
					},
				},
			}),
	);

	const config = useMemo(
		() =>
			createWalletUiConfig({
				clusters: [createSolanaDevnet()],
			}),
		[],
	);

	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<QueryClientProvider client={queryClient}>
					<WalletUi config={config}>
						<Header />
						{children}
						<TanStackDevtools
							config={{
								position: "bottom-right",
							}}
							plugins={[
								{
									name: "Tanstack Router",
									render: <TanStackRouterDevtoolsPanel />,
								},
							]}
						/>
					</WalletUi>
				</QueryClientProvider>
				<Scripts />
			</body>
		</html>
	);
}
