// Adding a spreadsheet of prompts to an existing prompt set: parsing the sheet,
// matching its rows against the prompts already in the project, and saving the
// result. Used by /api/batches/[id]/import and scripts/consolidate-prompt-set.ts.
import * as XLSX from 'xlsx'
import type { PrismaClient } from '@prisma/client'
import { COLUMN_ALIASES, normalizeRow, toGenericFields } from './normalize'

export const MAX_IMPORT_ROWS = 2000

export interface ImportRow {
  promptType: string
  category: string
  communityName: string
  city: string
  market: string
  levelOfCare: string
  promptText: string
}

// Prompts match when their text differs only in spacing, case or curly quotes.
export function promptKey(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()
}

function field(row: Record<string, unknown>, keys: readonly string[]): string {
  const byKey = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/[\s_-]+/g, '_'), v]))
  for (const k of keys) {
    const v = byKey.get(k.toLowerCase().replace(/[\s_-]+/g, '_'))
    if (v !== undefined && v !== null && v !== '') return String(v).trim()
  }
  return ''
}

export interface ParsedSheet {
  rows: ImportRow[]
  blankRows: number      // rows with no prompt text
  duplicates: string[]   // prompts listed more than once; the first row is used
}

// Reads the first sheet, with the same columns as an upload (prompt, category,
// prompt_type, location, city, market, service).
export function parsePromptSheet(data: ArrayBuffer | Buffer, options: { seniorLiving: boolean }): ParsedSheet {
  const wb = XLSX.read(data, { type: Buffer.isBuffer(data) ? 'buffer' : 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const raw = sheet ? (XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]) : []

  const rows: ImportRow[] = []
  const seen = new Set<string>()
  const duplicates: string[] = []
  let blankRows = 0
  for (const r of raw) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isUnknownCare: _u, ...row } = normalizeRow({
      promptType: field(r, COLUMN_ALIASES.promptType) || 'nonbrand',
      category: field(r, COLUMN_ALIASES.category),
      communityName: field(r, COLUMN_ALIASES.communityName),
      city: field(r, COLUMN_ALIASES.city),
      market: field(r, COLUMN_ALIASES.market),
      levelOfCare: field(r, COLUMN_ALIASES.levelOfCare),
      promptText: field(r, COLUMN_ALIASES.promptText),
    }, options)
    if (!row.promptText) { blankRows++; continue }
    const key = promptKey(row.promptText)
    if (seen.has(key)) { duplicates.push(row.promptText); continue }
    seen.add(key)
    rows.push(row)
  }
  return { rows, blankRows, duplicates }
}

export interface ExistingPrompt {
  id: string
  batchId: string
  promptText: string
  promptType: string
  category: string
  writable: boolean  // false for prompts in other people's sets: never changed
}

export interface ImportOptions {
  updateExisting: boolean   // give prompts already in the set the sheet's category and type
  updateOtherSets: boolean  // same for copies of those prompts in the project's other sets
}

export interface ImportPlan {
  alreadyInSet: number
  toCreate: ImportRow[]
  alsoInOtherSets: number   // of toCreate, prompts the project already tracks in another set
  updates: { id: string; promptType: string; category: string }[]
  updatedInSet: number
  updatedElsewhere: number
  unlisted: { id: string; promptText: string }[]  // in the set, not in the sheet; left alone
  setTotalAfter: number
}

// Works out what an import would change, without writing anything. Nothing is
// deleted, and prompts in sets the importer can't edit are never changed.
export function planImport(
  rows: ImportRow[],
  existing: ExistingPrompt[],
  targetBatchId: string,
  options: ImportOptions,
): ImportPlan {
  const byKey = new Map<string, ExistingPrompt[]>()
  for (const p of existing) byKey.set(promptKey(p.promptText), [...(byKey.get(promptKey(p.promptText)) ?? []), p])

  const plan: ImportPlan = {
    alreadyInSet: 0, toCreate: [], alsoInOtherSets: 0, updates: [],
    updatedInSet: 0, updatedElsewhere: 0, unlisted: [], setTotalAfter: 0,
  }
  for (const row of rows) {
    const matches = byKey.get(promptKey(row.promptText)) ?? []
    for (const p of matches) {
      const inSet = p.batchId === targetBatchId
      if (!p.writable || !(inSet ? options.updateExisting : options.updateOtherSets)) continue
      if (p.category === row.category && p.promptType === row.promptType) continue
      plan.updates.push({ id: p.id, promptType: row.promptType, category: row.category })
      if (inSet) plan.updatedInSet++
      else plan.updatedElsewhere++
    }
    if (matches.some((p) => p.batchId === targetBatchId)) {
      plan.alreadyInSet++
    } else {
      plan.toCreate.push(row)
      if (matches.length) plan.alsoInOtherSets++
    }
  }

  const listed = new Set(rows.map((r) => promptKey(r.promptText)))
  const inTarget = existing.filter((p) => p.batchId === targetBatchId)
  plan.unlisted = inTarget.filter((p) => !listed.has(promptKey(p.promptText))).map((p) => ({ id: p.id, promptText: p.promptText }))
  plan.setTotalAfter = inTarget.length + plan.toCreate.length
  return plan
}

// Saves a plan in one transaction.
export async function applyImport(
  prisma: PrismaClient,
  plan: ImportPlan,
  target: { id: string; projectId: string | null },
): Promise<void> {
  await prisma.$transaction([
    ...plan.updates.map((u) =>
      prisma.prompt.update({ where: { id: u.id }, data: { promptType: u.promptType, category: u.category } })),
    prisma.prompt.createMany({
      data: plan.toCreate.map((r) => ({ batchId: target.id, projectId: target.projectId, ...r, ...toGenericFields(r) })),
    }),
  ])
}
