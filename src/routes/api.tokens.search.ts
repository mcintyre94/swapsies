import { createFileRoute } from '@tanstack/react-router'

interface JupiterToken {
  id: string
  name: string
  symbol: string
  icon?: string
  decimals: number
  tags?: string[]
  isVerified?: boolean
}

export const Route = createFileRoute('/api/tokens/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const query = url.searchParams.get('query') || ''
        const limit = url.searchParams.get('limit')

        const apiKey = process.env.JUPITER_API_KEY

        if (!apiKey) {
          console.error('JUPITER_API_KEY environment variable is not set')
          return new Response(
            JSON.stringify({ error: 'API configuration error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }

        try {
          const params = new URLSearchParams({ query })
          if (limit) {
            params.append('limit', limit)
          }

          const response = await fetch(
            `https://api.jup.ag/ultra/v1/search?${params.toString()}`,
            {
              headers: {
                'x-api-key': apiKey,
              },
            }
          )

          if (!response.ok) {
            console.error(`Jupiter API error: ${response.status} ${response.statusText}`)
            return new Response(
              JSON.stringify({ error: 'Failed to fetch tokens from Jupiter API' }),
              { status: response.status, headers: { 'Content-Type': 'application/json' } }
            )
          }

          const data: JupiterToken[] = await response.json()

          return new Response(
            JSON.stringify(
              data.map((token) => ({
                address: token.id,
                name: token.name,
                symbol: token.symbol,
                logo: token.icon,
                decimals: token.decimals,
                tags: token.tags,
                isVerified: token.isVerified,
              }))
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          console.error('Error fetching tokens:', error)
          return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      },
    },
  },
})
