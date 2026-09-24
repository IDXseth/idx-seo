import { prisma } from './prisma'
import { getActiveCompetitors } from './competitors'
import { cleanTerms, type BrandTarget, type DetectionContext } from './detection'
import { YOUR_BRAND_NAME, YOUR_BRAND_DOMAIN } from './utils'

// Prompts not attached to a project yet (uploaded before projects can be picked
// in the UI) are scored for the original Senior Lifestyle brand, exactly as
// before projects existed.
const LEGACY_BRAND: BrandTarget = {
  label: YOUR_BRAND_NAME,
  names: [YOUR_BRAND_NAME, `${YOUR_BRAND_NAME} Corporation`],
  domains: [YOUR_BRAND_DOMAIN],
}

export interface PromptForDetection {
  projectId: string | null
  entityName: string
  communityName: string
  batch: { userId: string; projectId: string | null }
}

export async function getBrandTarget(projectId: string | null): Promise<BrandTarget> {
  if (!projectId) return LEGACY_BRAND
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, brandNames: true, primaryDomain: true, additionalDomains: true },
  })
  if (!project) return LEGACY_BRAND
  const names = cleanTerms(project.brandNames)
  return {
    label: names[0] ?? project.name,
    names: names.length > 0 ? names : [project.name],
    domains: cleanTerms([project.primaryDomain, ...project.additionalDomains]),
  }
}

export async function getDetectionContext(prompt: PromptForDetection): Promise<DetectionContext> {
  const [brand, competitors] = await Promise.all([
    getBrandTarget(prompt.projectId ?? prompt.batch.projectId),
    // Competitors are still managed per user; they move onto projects with the project UI.
    getActiveCompetitors(prompt.batch.userId),
  ])
  return {
    brand,
    entityName: prompt.entityName || prompt.communityName || undefined,
    competitors: competitors.map((c) => ({
      id: c.id,
      label: c.brandName,
      names: cleanTerms([c.brandName, ...c.aliases.split(',')]),
      domains: [c.domain],
    })),
  }
}
