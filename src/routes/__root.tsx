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
				title: "Swapsies",
			},
			{
				name: "apple-mobile-web-app-title",
				content: "Swapsies",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				type: "image/png",
				href: "/favicon-96x96.png",
				sizes: "96x96",
			},
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg",
			},
			{
				rel: "shortcut icon",
				href: "/favicon.ico",
			},
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "manifest",
				href: "/site.webmanifest",
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
		<html lang="en" className="h-full">
			<head>
				<HeadContent />
			</head>
			<body className="h-full bg-slate-900 text-white">
				<div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900">
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
				</div>
				<Scripts />
			</body>
		</html>
	);
}
