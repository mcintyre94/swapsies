# Swapsies - Solana Swap UI with Tax Gain/Loss Display

## What It Does

Shows potential tax gain/loss when swapping tokens in a Jupiter swap UI, based on user-entered cost basis data.

## Core Flow

1. **User enters cost basis for tokens they own**

   - Search for a token (using Jupiter API)
   - Enter the cost basis (what they paid per token in USD)
   - Save it (where? localStorage for now)

2. **User connects Solana wallet**

   - Standard Solana wallet connection
   - Shows tokens in their wallet

3. **User swaps tokens**
   - Jupiter swap UI embedded in the app
   - When selecting an input token that has a saved cost basis:
     - Fetch current price
     - Calculate gain/loss: `(current_price - cost_basis) * amount`
     - Display the tax impact of this trade

## Cost Basis Entry

**Source:** User's tax software (manual entry)

**Input Options:**

1. **Direct:** Cost basis per token (e.g., "$22.50 per SOL")
2. **Calculated:** Total balance + Total cost basis
   - Example: "1000 SOL total, $22,500 total cost = $22.50 per token"
   - We calculate: `costBasisPerToken = totalCost / totalBalance`

**Note:** Cost basis is global (not per-wallet) since tax software aggregates across all wallets.

### Cost Basis Data Structure

```typescript
interface TokenCostBasis {
  tokenAddress: string; // Solana mint address
  costBasisUSD: number; // Average cost per token in USD
  tokenName: string; // For display
  tokenSymbol: string; // For display
  tokenLogo?: string; // For display
}
```

### Tax Calculation Display

When swapping Token A → Token B:

- Show: "Selling X amount of TokenA"
- Show: Cost basis per token, current price per token
- Show: Total gain/loss in USD
- Show: Percentage gain/loss
- **No tax estimates** - just raw data, not tax advice
- **No short-term vs long-term** - no purchase date tracking

### Jupiter Integration

- **Custom swap UI** - built from scratch using Jupiter Swap API
- Allows better integration of cost basis data into the UX
- Full control over layout and flow

### Storage

- localStorage - simple key-value store
- Global cost basis (not per-wallet)
- Format: `{ [tokenMintAddress]: TokenCostBasis }`

## Tech Stack

**Current:**

- TanStack Start (React + Router)
- Tailwind CSS
- Vite

**Need to Add:**

- Wallet adapter: `@solana/wallet-adapter-react`
- Solana web3: `@solana/web3.js`
- Jupiter integration (API or Terminal widget)

## Implementation Status

- [x] Token search API route (`/api/tokens/search`)
- [ ] Cost basis management page/component
- [ ] LocalStorage helper functions for cost basis
- [ ] Wallet connection setup (@solana/wallet-adapter-react)
- [ ] Custom Jupiter swap UI
- [ ] Price fetching (Jupiter Price API v2)
- [ ] Tax gain/loss calculation logic
- [ ] Display gain/loss in swap UI

## Next Steps

1. Build cost basis entry form (token search + cost basis input)
2. Implement localStorage storage layer
3. Set up Solana wallet connection
4. Build custom swap UI with Jupiter API
5. Add price fetching
6. Calculate and display gain/loss when swapping

---

**Updated:** December 28, 2025
