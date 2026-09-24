import { prisma } from './prisma'

export interface ProjectOption {
  id: string
  name: string
}

// "Projects" are prompt-run batches (the Batch model) — the user-facing term used
// throughout /run (Share Project, Delete Project, etc). Lists every batch that has
// at least one prompt, for the dashboard's project switcher.
export async function getProjectList(): Promise<ProjectOption[]> {
  return prisma.batch.findMany({
    where: { prompts: { some: {} } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true },
  })
}
