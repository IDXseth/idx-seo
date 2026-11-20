import { prisma } from './prisma'
import { promptScope } from './projects'

export interface PromptSetOption {
  id: string
  name: string
}

// Prompt sets are uploaded batches of prompts (the Batch model) within the
// active project. Lists every one with at least one prompt the viewer can read,
// for the dashboard's prompt-set filter.
export async function getPromptSetList(): Promise<PromptSetOption[]> {
  return prisma.batch.findMany({
    where: { prompts: { some: await promptScope() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true },
  })
}
