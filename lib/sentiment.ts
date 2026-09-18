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
