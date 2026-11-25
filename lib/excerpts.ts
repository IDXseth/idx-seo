import { termsPattern, type DetectionContext } from './detection'

// The sentences of an AI answer that name the tracked brand, the prompt's own
// location/product, or a competitor, using the same whole-word rule as
// detection, so an excerpt shows exactly what was counted. Used by the
// spreadsheet export to keep what matters when full answers are too long.

// Excel rejects longer cells (the file opens with a repair prompt).
export const EXCEL_CELL_LIMIT = 32_767

const SEPARATOR = ' … '
const TRUNCATED = ' … [truncated]'

function mentionTerms(ctx: DetectionContext): string[] {
  return [
    ...ctx.brand.names,
    ...(ctx.entityName ? [ctx.entityName] : []),
    ...ctx.competitors.flatMap((c) => c.names),
  ]
}

// Splits on line breaks first, so markdown list items and headings stay
// separate, then into sentences within each line.
function sentences(text: string): string[] {
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
  const out: string[] = []
  for (const line of text.split(/\n+/)) {
    for (const { segment } of segmenter.segment(line)) {
      const s = segment.trim()
      if (s) out.push(s)
    }
  }
  return out
}

export function mentionExcerpt(text: string, ctx: DetectionContext, maxChars = EXCEL_CELL_LIMIT): string {
  const pattern = termsPattern(mentionTerms(ctx))
  if (!text || !pattern) return ''
  const hits = sentences(text).filter((s) => pattern.test(s))
  return fitToLimit(hits.join(SEPARATOR), maxChars)
}

// Text cut to fit a cell, marked when it was cut.
export function fitToLimit(text: string, maxChars = EXCEL_CELL_LIMIT): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - TRUNCATED.length) + TRUNCATED
}
