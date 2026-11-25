import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getViewer, isSuperUser, readableBatchWhere } from '@/lib/access'
import { resolveSegmentLabels } from '@/lib/segment-labels'
import { applyImport, MAX_IMPORT_ROWS, parsePromptSheet, planImport } from '@/lib/prompt-import'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const UNLISTED_SHOWN = 50

// POST /api/batches/[id]/import — add a spreadsheet of prompts to this prompt set.
// Form fields: file; commit ("true" saves, anything else only previews);
// updateExisting and updateOtherSets ("false" turns either off, both default on).
// The response describes the changes, whether previewed or saved.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const batch = await prisma.batch.findUnique({
    where: { id },
    select: { id: true, userId: true, projectId: true, project: { select: { segmentLabels: true } } },
  })
  const superUser = isSuperUser(viewer.email)
  if (!batch || !(superUser || batch.userId === viewer.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a spreadsheet to upload' }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'The file is larger than 5 MB' }, { status: 400 })

  const commit = form?.get('commit') === 'true'
  const options = {
    updateExisting: form?.get('updateExisting') !== 'false',
    updateOtherSets: form?.get('updateOtherSets') !== 'false',
  }

  // Prompts without a project get the senior-living rules, as everywhere else.
  const seniorLiving = batch.projectId
    ? resolveSegmentLabels(batch.project?.segmentLabels).preset === 'senior-living'
    : true

  let sheet
  try {
    sheet = parsePromptSheet(await file.arrayBuffer(), { seniorLiving })
  } catch {
    return NextResponse.json({ error: "That file couldn't be read as a spreadsheet" }, { status: 400 })
  }
  if (sheet.rows.length === 0) {
    return NextResponse.json({ error: 'No prompts found. The first sheet needs a "prompt" column.' }, { status: 400 })
  }
  if (sheet.rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ error: `The sheet has ${sheet.rows.length} prompts; the limit is ${MAX_IMPORT_ROWS}` }, { status: 400 })
  }

  // Only prompts in sets the viewer can read are matched, and only those in sets
  // they can edit are ever changed.
  const existing = await prisma.prompt.findMany({
    where: batch.projectId
      ? { projectId: batch.projectId, batch: readableBatchWhere(viewer) }
      : { batchId: batch.id },
    select: { id: true, batchId: true, promptText: true, promptType: true, category: true, batch: { select: { userId: true } } },
  })
  const plan = planImport(
    sheet.rows,
    existing.map(({ batch: owner, ...p }) => ({ ...p, writable: superUser || owner.userId === viewer.id })),
    batch.id,
    options,
  )

  if (commit) {
    try {
      await applyImport(prisma, plan, batch)
    } catch (error) {
      console.error('Prompt import error:', error)
      return NextResponse.json({ error: 'Failed to save the prompts' }, { status: 500 })
    }
  }

  return NextResponse.json({
    saved: commit,
    rows: sheet.rows.length,
    blankRows: sheet.blankRows,
    duplicates: sheet.duplicates,
    alreadyInSet: plan.alreadyInSet,
    added: plan.toCreate.length,
    alsoInOtherSets: plan.alsoInOtherSets,
    updatedInSet: plan.updatedInSet,
    updatedElsewhere: plan.updatedElsewhere,
    unlistedCount: plan.unlisted.length,
    unlisted: plan.unlisted.slice(0, UNLISTED_SHOWN).map((p) => p.promptText),
    setTotalAfter: plan.setTotalAfter,
  })
}
