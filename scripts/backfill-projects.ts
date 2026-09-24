// Attaches existing data to a Senior Lifestyle project after the
// 20260924000000_add_projects_competitors migration. Idempotent — re-run it to
// pick up batches uploaded before project selection exists in the UI.
//
//   npx tsx scripts/backfill-projects.ts [--owner=email@example.com] [--dry-run]
//
// --owner defaults to the owner of the oldest batch.
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, statement_timeout: 30000 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const ownerEmail = args.find((a) => a.startsWith('--owner='))?.slice('--owner='.length)

const SENIOR_LIFESTYLE = {
  name: 'Senior Lifestyle',
  primaryDomain: 'seniorlifestyle.com',
  // Same strings lib/ai-clients.ts checkMention matches today
  brandNames: ['Senior Lifestyle', 'Senior Lifestyle Corporation'],
  sitemapUrl: 'https://www.seniorlifestyle.com/community-sitemap.xml',
  sitemapPathPrefix: '/resources/senior-living/',
  segmentLabels: { market: 'Market', city: 'City', levelOfCare: 'Level of Care' },
}

async function resolveOwner() {
  if (ownerEmail) {
    const user = await prisma.user.findUnique({ where: { email: ownerEmail } })
    if (!user) throw new Error(`No user with email ${ownerEmail}`)
    return user
  }
  const oldest = await prisma.batch.findFirst({ orderBy: { createdAt: 'asc' }, include: { user: true } })
  if (!oldest) throw new Error('No batches found — nothing to backfill. Pass --owner to create the project anyway.')
  return oldest.user
}

async function main() {
  const owner = await resolveOwner()
  console.log(`Project owner: ${owner.email}${dryRun ? ' (dry run)' : ''}`)

  const existing = await prisma.project.findUnique({
    where: { userId_primaryDomain: { userId: owner.id, primaryDomain: SENIOR_LIFESTYLE.primaryDomain } },
  })

  const [unassignedBatches, promptsMissingProject, promptsMissingSegments] = await Promise.all([
    prisma.batch.count({ where: { projectId: null } }),
    prisma.prompt.count({ where: { projectId: null } }),
    prisma.prompt.count({ where: { segments: { equals: Prisma.DbNull } } }),
  ])

  console.log(`Project: ${existing ? `exists (${existing.id})` : 'will be created'}`)
  console.log(`Batches without a project:      ${unassignedBatches}`)
  console.log(`Prompts without a project:      ${promptsMissingProject}`)
  console.log(`Prompts without entity/segments: ${promptsMissingSegments}`)

  if (dryRun) return

  // Never overwrite a project's config once it exists — it may have been edited since.
  const project = existing ?? await prisma.project.create({
    data: { ...SENIOR_LIFESTYLE, userId: owner.id, gscSiteUrl: owner.gscSiteUrl },
  })

  const [batches, prompts, generic] = await prisma.$transaction([
    prisma.batch.updateMany({ where: { projectId: null }, data: { projectId: project.id } }),
    prisma.$executeRaw`
      UPDATE "Prompt" p SET "projectId" = b."projectId"
      FROM "Batch" b
      WHERE p."batchId" = b.id AND p."projectId" IS NULL AND b."projectId" IS NOT NULL`,
    // Mirrors toGenericFields in lib/normalize.ts: empty legacy values are omitted
    prisma.$executeRaw`
      UPDATE "Prompt" SET
        "entityName" = "communityName",
        "segments" = jsonb_strip_nulls(jsonb_build_object(
          'market', NULLIF("market", ''),
          'city', NULLIF("city", ''),
          'levelOfCare', NULLIF("levelOfCare", '')
        ))
      WHERE "segments" IS NULL`,
  ])

  console.log(`\nProject ${project.id} (${project.name})`)
  console.log(`Batches attached:          ${batches.count}`)
  console.log(`Prompts attached:          ${prompts}`)
  console.log(`Prompts entity/segments:   ${generic}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => pool.end())
