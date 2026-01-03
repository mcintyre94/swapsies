import { Link } from "@tanstack/react-router";

export default function Header() {
	return (
		<header className="p-4 flex items-center justify-between bg-gray-800 text-white shadow-lg">
			<h1 className="text-xl font-semibold">
				<Link to="/" className="flex items-center gap-3">
					<img
						src="/swapsies-logo-400.png"
						alt="Swapsies Logo"
						className="h-10"
					/>
					<span className="text-2xl font-bold">Swapsies</span>
				</Link>
			</h1>

			<nav className="flex items-center gap-6">
				<Link
					to="/"
					className="font-medium px-3 py-2 rounded-lg transition-colors"
					activeOptions={{ exact: true }}
					activeProps={{
						className: "bg-teal-600 hover:bg-teal-700",
					}}
					inactiveProps={{
						className: "hover:bg-gray-700",
					}}
				>
					Swap
				</Link>

				<Link
					to="/cost-basis"
					className="font-medium px-3 py-2 rounded-lg transition-colors"
					activeProps={{
						className: "bg-teal-600 hover:bg-teal-700",
					}}
					inactiveProps={{
						className: "hover:bg-gray-700",
					}}
				>
					Cost Basis
				</Link>
			</nav>
		</header>
	);
}
