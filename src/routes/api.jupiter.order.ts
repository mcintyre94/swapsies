import { createFileRoute } from '@tanstack/react-router'

interface JupiterOrderResponse {
  mode: string
  inAmount: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  priceImpactPct: string
  routePlan: Array<{
    swapInfo: Record<string, unknown>
    percent: number
    bps: number
  }>
  feeMint: string
  feeBps: number
  taker?: string
  gasless: boolean
  signatureFeeLamports: number
  transaction?: string
  prioritizationFeeLamports: number
  rentFeeLamports: number
  inputMint: string
  outputMint: string
  swapType: string
  router: string
  requestId: string
  inUsdValue: number
  outUsdValue: number
  priceImpact: number
  swapUsdValue: number
  totalTime: number
  errorCode?: string
  errorMessage?: string
}

export const Route = createFileRoute('/api/jupiter/order')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const inputMint = url.searchParams.get('inputMint')
        const outputMint = url.searchParams.get('outputMint')
        const amount = url.searchParams.get('amount')
        const taker = url.searchParams.get('taker')

        // Validate required parameters
        if (!inputMint || !outputMint || !amount) {
          return new Response(
            JSON.stringify({
              error: 'Missing required parameters: inputMint, outputMint, and amount are required'
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }

        const apiKey = process.env.JUPITER_API_KEY

        if (!apiKey) {
          console.error('JUPITER_API_KEY environment variable is not set')
          return new Response(
            JSON.stringify({ error: 'API configuration error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }

        try {
          // Build query parameters
          const params = new URLSearchParams({
            inputMint,
            outputMint,
            amount,
          })

          if (taker) {
            params.append('taker', taker)
          }

          const response = await fetch(
            `https://api.jup.ag/ultra/v1/order?${params.toString()}`,
            {
              headers: {
                'x-api-key': apiKey,
              },
            }
          )

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error(`Jupiter API error: ${response.status} ${response.statusText}`, errorData)
            return new Response(
              JSON.stringify(errorData || { error: 'Failed to get order from Jupiter API' }),
              { status: response.status, headers: { 'Content-Type': 'application/json' } }
            )
          }

          const data: JupiterOrderResponse = await response.json()

          return new Response(
            JSON.stringify(data),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          console.error('Error fetching Jupiter order:', error)
          return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      },
    },
  },
})
