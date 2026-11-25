// Makes one prompt set match a spreadsheet: recategorizes the prompts it already
// has, and adds the ones it's missing. Prompts the spreadsheet lists that live in
// another set of the same project are copied in (the original stays, with its
// results), and every copy of a listed prompt in the project gets the new
// category and type, so all sets report the same way. Nothing is deleted:
// prompts in the set that the spreadsheet doesn't list are only reported.
//
//   npx tsx scripts/consolidate-prompt-set.ts --project="Clover Test" \
//     --set="2026-11-16-ai-prompts-upload-104" --file=prompts.xlsx [--dry-run]
//
// Reads the first sheet, with the same columns as an upload (prompt, category,
// prompt_type, ...). Run the set from the Run page afterwards.
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as XLSX from 'xlsx'
import * as dotenv from 'dotenv'
import { COLUMN_ALIASES, normalizeRow, toGenericFields } from '../lib/normalize'

dotenv.config({ path: '.env.local' })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, statement_timeout: 30000 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const args = process.argv.slice(2)
const arg = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const dryRun = args.includes('--dry-run')
const projectName = arg('project')
const setName = arg('set')
const file = arg('file')

// Matches prompt text despite spacing, case and curly-quote differences.
const textKey = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()

function field(row: Record<string, unknown>, keys: readonly string[]): string {
  const byKey = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/[\s_-]+/g, '_'), v]))
  for (const k of keys) {
    const v = byKey.get(k.toLowerCase().replace(/[\s_-]+/g, '_'))
    if (v !== undefined && v !== null && v !== '') return String(v).trim()
  }
  return ''
}

async function main() {
  if (!projectName || !setName || !file) {
    throw new Error('Usage: --project="<name>" --set="<prompt set name>" --file=<xlsx> [--dry-run]')
  }

  const projects = await prisma.project.findMany({ where: { name: projectName }, select: { id: true, segmentLabels: true } })
  if (projects.length !== 1) throw new Error(`Expected one project named "${projectName}", found ${projects.length}`)
  const project = projects[0]
  const seniorLiving = (project.segmentLabels as { preset?: string } | null)?.preset === 'senior-living'

  const sets = await prisma.batch.findMany({ where: { projectId: project.id, name: setName } })
  if (sets.length !== 1) throw new Error(`Expected one prompt set named "${setName}" in the project, found ${sets.length}`)
  const target = sets[0]

  const wb = XLSX.readFile(file)
  const rows = (XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as Record<string, unknown>[])
    .map((row) => normalizeRow({
      promptType: field(row, COLUMN_ALIASES.promptType) || 'nonbrand',
      category: field(row, COLUMN_ALIASES.category),
      communityName: field(row, COLUMN_ALIASES.communityName),
      city: field(row, COLUMN_ALIASES.city),
      market: field(row, COLUMN_ALIASES.market),
      levelOfCare: field(row, COLUMN_ALIASES.levelOfCare),
      promptText: field(row, COLUMN_ALIASES.promptText),
    }, { seniorLiving }))
    .filter((r) => r.promptText)

  const seen = new Set<string>()
  const dupes = rows.filter((r) => (seen.has(textKey(r.promptText)) ? true : (seen.add(textKey(r.promptText)), false)))
  if (dupes.length) throw new Error(`The spreadsheet lists these prompts twice:\n  ${dupes.map((d) => d.promptText).join('\n  ')}`)

  const prompts = await prisma.prompt.findMany({
    where: { projectId: project.id },
    select: { id: true, batchId: true, promptText: true, promptType: true, category: true },
  })
  const byText = new Map<string, typeof prompts>()
  for (const p of prompts) byText.set(textKey(p.promptText), [...(byText.get(textKey(p.promptText)) ?? []), p])

  const updates: { id: string; promptType: string; category: string }[] = []
  const toCopy: typeof rows = []
  const toAdd: typeof rows = []
  for (const r of rows) {
    const matches = byText.get(textKey(r.promptText)) ?? []
    for (const p of matches) {
      if (p.category !== r.category || p.promptType !== r.promptType) {
        updates.push({ id: p.id, promptType: r.promptType, category: r.category })
      }
    }
    if (matches.some((p) => p.batchId === target.id)) continue
    ;(matches.length ? toCopy : toAdd).push(r)
  }
  const listed = new Set(rows.map((r) => textKey(r.promptText)))
  const unlisted = prompts.filter((p) => p.batchId === target.id && !listed.has(textKey(p.promptText)))
  const inSet = prompts.filter((p) => p.batchId === target.id).length

  console.log(`Project "${projectName}", prompt set "${setName}" (${inSet} prompts)${dryRun ? ' — dry run, nothing written' : ''}`)
  console.log(`Spreadsheet rows:                          ${rows.length}`)
  console.log(`Already in the set:                        ${rows.length - toCopy.length - toAdd.length}`)
  console.log(`Copied in from another set of the project: ${toCopy.length}`)
  console.log(`New prompts added:                         ${toAdd.length}`)
  console.log(`Prompts recategorized (all sets):          ${updates.length}`)
  console.log(`In the set but not in the spreadsheet:     ${unlisted.length} (left as they are)`)
  for (const p of unlisted) console.log(`  - ${p.promptText}`)
  console.log(`The set will have ${inSet + toCopy.length + toAdd.length} prompts.`)

  if (dryRun) return

  await prisma.$transaction([
    ...updates.map((u) => prisma.prompt.update({ where: { id: u.id }, data: { promptType: u.promptType, category: u.category } })),
    prisma.prompt.createMany({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      data: [...toCopy, ...toAdd].map(({ isUnknownCare: _u, ...r }) => ({
        batchId: target.id, projectId: project.id, ...r, ...toGenericFields(r),
      })),
    }),
  ])
  console.log('Done. Run the prompt set from the Run page to collect results for the new prompts.')
}

main()
  .catch((err) => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
