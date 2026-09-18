export const SENTIMENTS = ['positive', 'neutral', 'negative'] as const
export type Sentiment = typeof SENTIMENTS[number]

export interface SentimentCounts {
  positive: number
  neutral: number
  negative: number
  total: number
}

export function countSentiments(results: { sentiment: string }[]): SentimentCounts {
  let positive = 0
  let neutral = 0
  let negative = 0
  for (const r of results) {
    if (r.sentiment === 'positive') positive++
    else if (r.sentiment === 'negative') negative++
    else neutral++
  }
  return { positive, neutral, negative, total: positive + neutral + negative }
}

// One row per Result, denormalized with the dimensions the sentiment breakdown
// widget filters by (project = Batch, and brand/nonbrand prompt type).
export interface SentimentRow {
  sentiment: string
  promptType: string
  projectId: string
  projectName: string
}
