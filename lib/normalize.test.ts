import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRow } from './normalize'

const row = (category: string) => ({
  promptType: 'nonbrand', category, communityName: '', city: '', market: '', levelOfCare: '', promptText: 'q',
})

test('other industries keep a category as written', () => {
  assert.equal(normalizeRow(row('  POS Systems  &  Hardware '), { seniorLiving: false }).category, 'POS Systems & Hardware')
  assert.equal(normalizeRow(row('Running the Business'), { seniorLiving: false }).category, 'Running the Business')
})

test('senior-living categories are still title-cased', () => {
  assert.equal(normalizeRow(row('assisted living costs'), { seniorLiving: true }).category, 'Assisted Living Costs')
})
