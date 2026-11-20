import { prisma } from '@/lib/prisma'
import { getActiveProject, promptScope } from '@/lib/projects'
import { CompetitorsManager } from '@/components/competitors-manager'

export const dynamic = 'force-dynamic'

async function getPromptCount(): Promise<number> {
  try {
    return await prisma.prompt.count({ where: await promptScope() })
  } catch {
    return 0
  }
}

export default async function CompetitorsPage() {
  const [project, promptCount] = await Promise.all([getActiveProject().catch(() => null), getPromptCount()])

  return (
    <div className="max-w-4xl mx-auto">
      <CompetitorsManager
        promptCount={promptCount}
        projectName={project?.name ?? null}
        canEdit={project?.canEdit ?? false}
      />
    </div>
  )
}
