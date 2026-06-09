import { Fragment } from 'react'

const BRAND_TERMS = ['Senior Lifestyle Corporation', 'Senior Lifestyle']

/**
 * Renders text with case-insensitive highlights for the community name and brand terms.
 * Returns a Fragment of plain strings and <mark> spans — safe for server components.
 */
export function HighlightedText({
  text,
  communityName,
  className,
}: {
  text: string
  communityName?: string | null
  className?: string
}) {
  const terms = [
    ...(communityName ? [communityName] : []),
    ...BRAND_TERMS,
  ].filter(Boolean)

  const parts = splitWithHighlights(text, terms)

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.highlight ? (
          <mark
            key={i}
            className="bg-yellow-100 text-yellow-900 rounded px-0.5 font-medium not-italic"
            style={{ backgroundColor: '#fef9c3', color: '#713f12' }}
          >
            {part.text}
          </mark>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        )
      )}
    </span>
  )
}

function splitWithHighlights(
  text: string,
  terms: string[]
): Array<{ text: string; highlight: boolean }> {
  if (!text || terms.length === 0) return [{ text, highlight: false }]

  // Build a single regex that matches any term, longest first to avoid partial matches
  const sorted = [...terms].sort((a, b) => b.length - a.length)
  const pattern = sorted.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const regex = new RegExp(`(${pattern})`, 'gi')

  const result: Array<{ text: string; highlight: boolean }> = []
  let last = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      result.push({ text: text.slice(last, match.index), highlight: false })
    }
    result.push({ text: match[0], highlight: true })
    last = match.index + match[0].length
  }

  if (last < text.length) {
    result.push({ text: text.slice(last), highlight: false })
  }

  return result.length > 0 ? result : [{ text, highlight: false }]
}
