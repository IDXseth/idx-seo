// Token and cost accounting for audit runs. Each platform query fills a
// UsageMeter from the usage its API reports; the totals are stored on the
// Result row so run and project costs can be summed later.
//
// Costs are list-price estimates in USD, frozen at run time — update the
// tables below when providers change pricing (old rows keep their old cost).
// They won't match invoices exactly: free tiers (e.g. Gemini's daily free
// grounding requests), cached-input discounts and plan credits aren't modeled.

// USD per 1M tokens.
const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'sonar': { input: 1, output: 1 },
}

// USD per search / grounded request.
const SEARCH_PRICES = {
  openai_web_search: 0.025,   // web_search_preview on gpt-4o: $25 / 1K calls
  claude_web_search: 0.01,    // Anthropic web search: $10 / 1K searches
  gemini_grounding: 0.035,    // Grounding with Google Search: $35 / 1K prompts
  perplexity_request: 0.005,  // Sonar request fee, low search context: $5 / 1K
  searchapi: 0.004,           // SearchAPI.io Developer plan: $40 / 10K searches
} as const

export type SearchKind = keyof typeof SEARCH_PRICES

export interface UsageTotals {
  inputTokens: number
  outputTokens: number
  searchCount: number
  costUsd: number
}

export function emptyUsage(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0, searchCount: 0, costUsd: 0 }
}

export function addUsage(a: UsageTotals, b: UsageTotals): UsageTotals {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    searchCount: a.searchCount + b.searchCount,
    costUsd: a.costUsd + b.costUsd,
  }
}

export class UsageMeter {
  totals: UsageTotals = emptyUsage()

  addTokens(model: string, inputTokens = 0, outputTokens = 0) {
    this.totals.inputTokens += inputTokens
    this.totals.outputTokens += outputTokens
    const price = MODEL_PRICES[model]
    if (!price) {
      console.warn(`No token price for model "${model}" — its cost is not counted`)
      return
    }
    this.totals.costUsd += (inputTokens * price.input + outputTokens * price.output) / 1_000_000
  }

  addSearches(kind: SearchKind, count = 1) {
    if (count <= 0) return
    this.totals.searchCount += count
    this.totals.costUsd += count * SEARCH_PRICES[kind]
  }

  // For APIs that report their own total (Perplexity): tokens are recorded,
  // the reported cost replaces our estimate.
  addReported(inputTokens: number, outputTokens: number, searchCount: number, costUsd: number) {
    this.totals.inputTokens += inputTokens
    this.totals.outputTokens += outputTokens
    this.totals.searchCount += searchCount
    this.totals.costUsd += costUsd
  }
}

// Columns written to Result: the platform query's usage plus any follow-up
// calls made for the same result (competitor sentiment). Without platform
// usage (e.g. the query timed out) the columns stay null — cost unknown.
export function usageColumns(platformUsage: UsageTotals | undefined, extra?: UsageTotals) {
  if (!platformUsage) return {}
  const usage = extra ? addUsage(platformUsage, extra) : platformUsage
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    searchCount: usage.searchCount,
    costUsd: usage.costUsd,
  }
}
