import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fitToLimit, mentionExcerpt } from './excerpts'
import type { DetectionContext } from './detection'

const ctx: DetectionContext = {
  brand: { label: 'Clover', names: ['Clover', 'Clover POS'], domains: ['clover.com'] },
  entityName: 'Clover Mini',
  competitors: [
    { id: 'c1', label: 'Square', names: ['Square'], domains: ['squareup.com'] },
    { id: 'c2', label: 'Toast', names: ['Toast', 'Toast POS'], domains: ['toasttab.com'] },
  ],
}

test('keeps only sentences naming the brand, its entity or a competitor, in order', () => {
  const answer = [
    'Choosing a POS depends on your business. Clover is popular with retailers.',
    'Many owners compare options carefully.',
    '- Square: low fees for small shops.',
    '- Toast POS suits restaurants. It has kitchen displays.',
    'The Clover Mini fits on a countertop.',
  ].join('\n')
  assert.equal(
    mentionExcerpt(answer, ctx),
    'Clover is popular with retailers. … - Square: low fees for small shops. … - Toast POS suits restaurants. … The Clover Mini fits on a countertop.'
  )
})

test('uses whole-word matching, like detection', () => {
  assert.equal(mentionExcerpt('Toasted bread is great. Squares are shapes.', ctx), '')
  assert.equal(mentionExcerpt("Square's fees are flat.", ctx), "Square's fees are flat.")
})

test('is empty when nothing tracked is named', () => {
  assert.equal(mentionExcerpt('Compare several systems before buying.', ctx), '')
  assert.equal(mentionExcerpt('', ctx), '')
})

test('cuts to the cell limit with a marker', () => {
  assert.equal(fitToLimit('short', 10), 'short')
  const cut = fitToLimit('x'.repeat(50), 30)
  assert.equal(cut.length, 30)
  assert.ok(cut.endsWith('[truncated]'))
})
