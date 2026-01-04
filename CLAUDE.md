# Swapsies - Claude Code Instructions

> **Note for Claude:** This file is located at `.claude/claude.md` and is automatically loaded into your context at the start of every conversation. When adding project-specific patterns or gotchas, **always update this file** rather than creating new documentation files. Check this file exists before creating any CLAUDE.md or similar files.

## Project Overview

Swapsies is a Solana token swap application built with TanStack Start. It allows users to:
- Swap tokens using Jupiter's Ultra API
- Track cost basis for tax purposes
- Import/export cost basis data

## Tech Stack

- **Framework**: TanStack Start (React with SSR)
- **Routing**: TanStack Router
- **Data Fetching**: TanStack Query
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Package Manager**: pnpm
- **Linting/Formatting**: Biome
- **TypeScript**: Strict mode

## Code Quality Standards

- **Always check TypeScript errors** after editing files using `mcp__ide__getDiagnostics`
- **Always run `pnpm typecheck`** to verify TypeScript has no errors
- **Fix all TypeScript and Biome diagnostics** before considering a task complete
- **Run `pnpm biome check --write .` after making changes** to auto-fix formatting and linting issues
- After auto-fixing, manually fix any remaining errors that can't be auto-fixed
- The codebase should maintain **zero errors** - use `pnpm biome check .` and `pnpm typecheck` to verify
- Prefer type safety over `any` when possible (use `unknown` instead)
- All buttons must have explicit `type` attribute (`type="button"` for non-submit buttons)
- Never use array indices as React keys - use stable identifiers instead

### Indentation and Whitespace

**This codebase uses TABS for indentation**, not spaces. When using the Edit tool:
- Always copy text exactly as shown in Read tool output (preserves actual whitespace)
- The Read tool output shows line numbers, but actual file content starts AFTER the line number prefix
- Biome will auto-format to tabs when you run `pnpm biome check --write .`

**Troubleshooting Edit errors:**

If you get "String to replace not found" errors, it's usually whitespace mismatches. Use `cat -A` to see exact characters:

```bash
sed -n 'START,ENDp' /path/to/file.tsx | cat -A
```

Where `^I` = tab, spaces show as spaces, and `$` = end of line.

## Architecture Patterns

### Server Functions vs API Routes

- **Use server functions** (in `/src/lib/server-functions.ts`) for type-safe server-client communication
- Server functions provide automatic serialization and full type safety
- Only use API routes for external/public endpoints

### Type Definitions

- Shared types live in `/src/types/`
- Import types from the shared location rather than duplicating
- Example: `JupiterToken`, `JupiterOrderResponse` are in `/src/types/jupiter.ts`

### TanStack Query Patterns

- Use query keys consistently: `["tokens", query]`, `["order", inputMint, outputMint, amount]`
- Set appropriate `staleTime` based on data freshness needs
- Use `placeholderData` for smooth UX during searches
- Cache expensive/static queries with long `staleTime`

### Component Structure

- Routes live in `/src/routes/` following TanStack Router file-based routing
- Shared utilities go in `/src/lib/`
- Use controlled components with React state
- Debounce search inputs (300ms typical)

### Server Functions Best Practices

**AbortSignal Support (Required)**

All server functions MUST accept and use AbortSignal for request cancellation:

```typescript
export const myServerFn = createServerFn({ method: "GET" })
    .inputValidator((input: MyInput) => input)
    .handler(async ({ data, signal }): Promise<MyResponse> => {
        // Always destructure 'signal' from handler params

        const response = await fetch(url, {
            headers: { /* ... */ },
            signal,  // Always pass signal to fetch
        });

        return await response.json();
    });
```

**Why:** Prevents wasted API requests when users navigate away or trigger new requests. Critical for rate-limited APIs like Jupiter.

**React Query Integration**

When calling server functions from React Query, always pass the signal:

```typescript
const { data } = useQuery({
    queryKey: ["my-data", param],
    queryFn: ({ signal }) => myServerFn({
        data: { param },
        signal  // Always pass signal
    }),
});
```

## Common Patterns

### TanStack Router - Styling Active Links

When styling navigation links with different hover states for active vs inactive states, use the `activeProps` and `inactiveProps` pattern:

```tsx
<Link
  to="/path"
  className="shared-classes-for-both-states"
  activeProps={{
    className: "classes-only-for-active-state",
  }}
  inactiveProps={{
    className: "classes-only-for-inactive-state",
  }}
>
  Link Text
</Link>
```

**Key insights:**
- TanStack Router **merges** the base `className` with either `activeProps.className` or `inactiveProps.className`
- Put shared styles in the base `className` (e.g., padding, font-weight, border-radius, transitions)
- Put state-specific styles in `activeProps`/`inactiveProps` only (e.g., background colors, hover states)
- **Don't duplicate** shared styles between base `className` and the props - they get merged automatically

**Example from Header.tsx:**
```tsx
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
```

This results in:
- **Active link:** `font-medium px-3 py-2 rounded-lg transition-colors bg-teal-600 hover:bg-teal-700`
- **Inactive link:** `font-medium px-3 py-2 rounded-lg transition-colors hover:bg-gray-700`

**Why use both `activeProps` and `inactiveProps`?**
If you only use `activeProps`, both the base className hover and active hover classes will be present on active links, causing CSS specificity conflicts where the wrong hover color might apply.

### Token Search

```typescript
const { data: tokens } = useQuery({
  queryKey: ["tokens", searchQuery],
  queryFn: () => searchTokens({ data: { query: searchQuery } }),
  enabled: searchQuery.trim().length > 0,
  staleTime: 5 * 60 * 1000,
});
```

### Number Inputs

- Always add `onWheel={(e) => e.currentTarget.blur()}` to prevent accidental scroll changes
- Use `type="number"` and `step="any"` for decimal inputs

### LocalStorage

- Helper functions with try/catch for safety: `getCostBasisData()`, `saveCostBasisData()`
- Use `useLayoutEffect` to load localStorage data on mount (prevents hydration issues)
- Never access localStorage during SSR (check `typeof window !== "undefined"`)

## Environment Variables

- `JUPITER_API_KEY` - Required for Jupiter Ultra API access
- Store in `.env` file (not checked into git)

## API Integration

### Jupiter Ultra API

- Token search: `/ultra/v1/search`
- Get order/quote: `/ultra/v1/order`
- All requests require `x-api-key` header
- Server functions handle API key securely

### Request Patterns

- Token amounts must be in native units (multiply by `10^decimals`)
- Always validate required parameters before API calls
- Handle errors gracefully with user-friendly messages

## UX Guidelines

- Show loading states with spinners during async operations
- Use placeholder data to keep previous results visible while loading
- Debounce user input to reduce API calls
- Provide clear error messages when operations fail
- Disable buttons when forms are invalid

## File Organization

```
src/
  components/       # Shared React components
  lib/             # Utilities and server functions
    server-functions.ts  # TanStack Start server functions
  routes/          # TanStack Router pages
    __root.tsx     # Root layout with QueryClientProvider
    index.tsx      # Home page
    swap.tsx       # Token swap interface
    cost-basis.tsx # Cost basis tracking
  types/           # Shared TypeScript types
    jupiter.ts     # Jupiter API types
```

## Development Workflow

1. Make code changes
2. Check diagnostics with `mcp__ide__getDiagnostics`
3. Run `pnpm typecheck` to verify TypeScript errors
4. Run `pnpm biome check --write .` to auto-fix formatting/linting
5. Fix any remaining TypeScript or Biome errors manually
6. Verify zero errors with `pnpm typecheck` and `pnpm biome check .`
7. Test in browser (dev server runs on port 3000)
8. Commit when feature is complete

## Solana Address Validation

### Using @solana/kit for Address Validation

Always use `@solana/kit` for Solana address validation (never use `@solana/web3.js`):

- **`Address` type** - Use this TypeScript type for typed addresses
- **`isAddress(str)`** - Check if a string is a valid Solana address (returns boolean)
- **`address(str)`** - Cast and validate a string to Address type (throws if invalid)

Example usage:

```typescript
import { type Address, address, isAddress } from "@solana/kit";

// Check if valid
if (isAddress(userInput)) {
  // userInput is a valid address
}

// Validate and convert (throws on invalid)
try {
  const addr: Address = address(userInput);
  // Use addr...
} catch (error) {
  // Handle invalid address
}
```

For validation utilities, see `/src/lib/validation.ts`.

### Network Configuration

- **The app only uses Solana mainnet** - No devnet or testnet support
- The `cluster` parameter in `createWalletUiConfig` (in `__root.tsx`) is required by the wallet-ui library but **not actually used**
- All transactions are signed and submitted to mainnet

## Wallet Integration Patterns

### Error Handling for Wallet Operations

When catching errors from wallet operations (signing transactions, connecting, etc.), be aware that wallet adapters may throw errors in different formats:

- Some wallets throw proper `Error` objects (`error instanceof Error`)
- Some wallets throw plain strings or other primitives

Always handle both cases when catching wallet errors:

```typescript
catch (error) {
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";

  // Now process errorMessage safely
}
```

This pattern was discovered when implementing transaction signing in SwapButton.tsx where certain wallet adapters threw string errors instead of Error objects.

### User-Friendly Error Messages

Detect common user rejection patterns and provide friendly messages:

```typescript
const isUserRejection =
  errorMessage.toLowerCase().includes("rejected") ||
  errorMessage.toLowerCase().includes("declined") ||
  errorMessage.toLowerCase().includes("denied") ||
  errorMessage.toLowerCase().includes("cancelled") ||
  errorMessage.toLowerCase().includes("canceled") ||
  (errorMessage.toLowerCase().includes("user") &&
    errorMessage.toLowerCase().includes("abort"));

const displayMessage = isUserRejection
  ? "Transaction signing was cancelled"
  : errorMessage;
```

## Don't Do

- Don't hardcode token addresses or API keys
- Don't use `fetch()` directly for internal APIs - use server functions
- Don't duplicate type definitions across files
- Don't add emojis to code unless explicitly requested
- Don't create documentation files unless requested
- Don't access `localStorage` during SSR
