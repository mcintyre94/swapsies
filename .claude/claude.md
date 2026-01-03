# Swapsies - Claude Code Instructions

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

## Don't Do

- Don't hardcode token addresses or API keys
- Don't use `fetch()` directly for internal APIs - use server functions
- Don't duplicate type definitions across files
- Don't add emojis to code unless explicitly requested
- Don't create documentation files unless requested
- Don't access `localStorage` during SSR
