import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { parsePromptSheet, planImport, promptKey, type ExistingPrompt, type ImportRow } from './prompt-import'

const row = (promptText: string, category = 'Payments', promptType = 'nonbrand'): ImportRow => ({
  promptText, category, promptType, communityName: '', city: '', market: '', levelOfCare: '',
})
const prompt = (id: string, batchId: string, promptText: string, category = 'Old', writable = true): ExistingPrompt => ({
  id, batchId, promptText, category, promptType: 'nonbrand', writable,
})
const all = { updateExisting: true, updateOtherSets: true }

test('prompt text matches despite spacing, case and curly quotes', () => {
  assert.equal(promptKey('  What’s the  BEST pos? '), promptKey("what's the best pos?"))
  assert.notEqual(promptKey('best pos'), promptKey('best pos system'))
})

test('rows are recategorized, copied from other sets, or added; unlisted prompts are reported', () => {
  const existing = [
    prompt('a', 'target', 'in the set'),
    prompt('b', 'target', 'not in the sheet'),
    prompt('c', 'other', 'only in another set'),
  ]
  const plan = planImport([row('In the  set'), row('only in another set'), row('brand new')], existing, 'target', all)
  assert.equal(plan.alreadyInSet, 1)
  assert.deepEqual(plan.toCreate.map((r) => r.promptText), ['only in another set', 'brand new'])
  assert.equal(plan.alsoInOtherSets, 1)
  assert.deepEqual(plan.updates.map((u) => u.id).sort(), ['a', 'c'])
  assert.equal(plan.updatedInSet, 1)
  assert.equal(plan.updatedElsewhere, 1)
  assert.deepEqual(plan.unlisted.map((p) => p.id), ['b'])
  assert.equal(plan.setTotalAfter, 4)
})

test('options turn off recategorizing, and prompts already right are not rewritten', () => {
  const existing = [prompt('a', 'target', 'q1'), prompt('c', 'other', 'q1'), prompt('d', 'target', 'q2', 'Payments')]
  assert.deepEqual(planImport([row('q1'), row('q2')], existing, 'target', all).updates.map((u) => u.id), ['a', 'c'])
  assert.deepEqual(planImport([row('q1')], existing, 'target', { updateExisting: false, updateOtherSets: true }).updates.map((u) => u.id), ['c'])
  assert.deepEqual(planImport([row('q1')], existing, 'target', { updateExisting: true, updateOtherSets: false }).updates.map((u) => u.id), ['a'])
})

test("prompts in sets the importer can't edit are matched but never changed", () => {
  const plan = planImport([row('q1')], [prompt('x', 'someone-elses', 'q1', 'Old', false)], 'target', all)
  assert.equal(plan.updates.length, 0)
  assert.equal(plan.toCreate.length, 1)
  assert.equal(plan.alsoInOtherSets, 1)
})

test('the sheet parser skips blank rows and keeps the first of a repeated prompt', () => {
  const ws = XLSX.utils.json_to_sheet([
    { prompt: 'Best POS?', category: 'POS Systems', prompt_type: 'brand' },
    { prompt: '', category: 'Retail' },
    { prompt: 'best  pos?', category: 'Retail' },
    { Prompt: 'Card fees', Category: 'Payments' },
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'upload')
  const sheet = parsePromptSheet(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { seniorLiving: false })
  assert.deepEqual(sheet.rows.map((r) => [r.promptText, r.category, r.promptType]), [
    ['Best POS?', 'POS Systems', 'brand'],
    ['Card fees', 'Payments', 'nonbrand'],
  ])
  assert.equal(sheet.blankRows, 1)
  assert.deepEqual(sheet.duplicates, ['best  pos?'])
})
