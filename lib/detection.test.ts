import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detect, firstMentionIndex, hostMatches, isCitedBy, splitMentions, type DetectionContext } from './detection'

const ctx: DetectionContext = {
  brand: { label: 'Senior Lifestyle', names: ['Senior Lifestyle', 'Senior Lifestyle Corporation'], domains: ['seniorlifestyle.com'] },
  entityName: 'Heritage Pines',
  competitors: [
    { id: 'c1', label: 'Brookdale', names: ['Brookdale', 'Brookdale Senior Living'], domains: ['brookdale.com'] },
    { id: 'c2', label: 'Sunrise', names: ['Sunrise Senior Living'], domains: ['sunriseseniorliving.com'] },
  ],
}

const cite = (url: string, isExplicitCitation = true) => ({ url, domain: new URL(url).hostname.replace(/^www\./, ''), isExplicitCitation })

test('mentions are case-insensitive whole words', () => {
  assert.equal(firstMentionIndex('Try senior lifestyle communities.', ['Senior Lifestyle']), 4)
  assert.equal(firstMentionIndex('Brookdales everywhere', ['Brookdale']), -1)
  assert.equal(firstMentionIndex('MyBrookdale app', ['Brookdale']), -1)
  assert.equal(firstMentionIndex("Brookdale's pricing", ['Brookdale']), 0)
  assert.equal(firstMentionIndex('(Brookdale)', ['Brookdale']), 1)
  assert.equal(firstMentionIndex('A.C.M.E. Corp', ['A.C.M.E.']), 0) // regex characters are escaped
})

test("naming the brand's own entity counts as a brand mention", () => {
  const d = detect('Heritage Pines is lovely.', [], ctx)
  assert.equal(d.brand.isMentioned, true)
  assert.equal(d.brand.position, 1)
})

test('positions rank everyone mentioned by first appearance', () => {
  const d = detect('Consider Sunrise Senior Living, Brookdale, or Senior Lifestyle.', [], ctx)
  assert.deepEqual(
    [d.brand.position, d.competitors[0].position, d.competitors[1].position],
    [3, 2, 1]
  )
  const none = detect('No brands here.', [], ctx)
  assert.equal(none.brand.position, null)
  assert.equal(none.competitors[0].isMentioned, false)
})

test('citations match the domain or its subdomains, never look-alikes', () => {
  assert.equal(hostMatches('www.seniorlifestyle.com', ['seniorlifestyle.com']), true)
  assert.equal(hostMatches('blog.seniorlifestyle.com', ['seniorlifestyle.com']), true)
  assert.equal(hostMatches('notseniorlifestyle.com', ['seniorlifestyle.com']), false)
  assert.equal(isCitedBy([cite('https://www.seniorlifestyle.com/x')], ['seniorlifestyle.com']), true)
})

test('only explicit citations count as cited', () => {
  assert.equal(isCitedBy([cite('https://seniorlifestyle.com/x', false)], ['seniorlifestyle.com']), false)
})

test('redirect-wrapped citation URLs resolve to their destination', () => {
  const wrapped = {
    url: 'https://www.google.com/goto?url=https%3A%2F%2Fwww.brookdale.com%2Fen%2Fcommunities',
    domain: 'google.com',
    isExplicitCitation: true,
  }
  assert.equal(isCitedBy([wrapped], ['brookdale.com']), true)
  assert.equal(isCitedBy([wrapped], ['seniorlifestyle.com']), false)
})

test('detect reports brand and competitor citations separately', () => {
  const d = detect('See Brookdale.', [cite('https://brookdale.com/a'), cite('https://seniorlifestyle.com/b')], ctx)
  assert.equal(d.brand.isCited, true)
  assert.equal(d.competitors[0].isCited, true)
  assert.equal(d.competitors[1].isCited, false)
})

test('splitMentions highlights exactly what detect counts', () => {
  const segments = splitMentions('Brookdale vs Senior Lifestyle Corporation, not Brookdales.', [
    { owner: 'you', terms: ctx.brand.names },
    { owner: 'c1', terms: ctx.competitors[0].names },
  ])
  assert.deepEqual(
    segments.filter((s) => s.owner).map((s) => [s.text, s.owner]),
    [['Brookdale', 'c1'], ['Senior Lifestyle Corporation', 'you']]
  )
  assert.equal(segments.map((s) => s.text).join(''), 'Brookdale vs Senior Lifestyle Corporation, not Brookdales.')
})
