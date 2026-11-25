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
// The same as "Add prompts from spreadsheet" on the Run page, with every option
// on and no access checks. Run the set from the Run page afterwards.
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import { applyImport, parsePromptSheet, planImport } from '../lib/prompt-import'

dotenv.config({ path: '.env.local' })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, statement_timeout: 30000 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const args = process.argv.slice(2)
const arg = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const dryRun = args.includes('--dry-run')
const projectName = arg('project')
const setName = arg('set')
const file = arg('file')

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

  const sheet = parsePromptSheet(readFileSync(file), { seniorLiving })
  if (sheet.duplicates.length) {
    throw new Error(`The spreadsheet lists these prompts twice:\n  ${sheet.duplicates.join('\n  ')}`)
  }

  const existing = await prisma.prompt.findMany({
    where: { projectId: project.id },
    select: { id: true, batchId: true, promptText: true, promptType: true, category: true },
  })
  const plan = planImport(
    sheet.rows,
    existing.map((p) => ({ ...p, writable: true })),
    target.id,
    { updateExisting: true, updateOtherSets: true },
  )

  console.log(`Project "${projectName}", prompt set "${setName}"${dryRun ? ' — dry run, nothing written' : ''}`)
  console.log(`Spreadsheet rows:                          ${sheet.rows.length}${sheet.blankRows ? ` (${sheet.blankRows} blank skipped)` : ''}`)
  console.log(`Already in the set:                        ${plan.alreadyInSet}`)
  console.log(`Copied in from another set of the project: ${plan.alsoInOtherSets}`)
  console.log(`New prompts added:                         ${plan.toCreate.length - plan.alsoInOtherSets}`)
  console.log(`Prompts recategorized (all sets):          ${plan.updates.length}`)
  console.log(`In the set but not in the spreadsheet:     ${plan.unlisted.length} (left as they are)`)
  for (const p of plan.unlisted) console.log(`  - ${p.promptText}`)
  console.log(`The set will have ${plan.setTotalAfter} prompts.`)

  if (dryRun) return
  await applyImport(prisma, plan, target)
  console.log('Done. Run the prompt set from the Run page to collect results for the new prompts.')
}

main()
  .catch((err) => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
