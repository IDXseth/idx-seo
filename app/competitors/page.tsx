import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CompetitorsManager } from '@/components/competitors-manager'

export const dynamic = 'force-dynamic'

async function getPromptCount(userId: string): Promise<number> {
  try {
    return await prisma.prompt.count({ where: { batch: { userId } } })
  } catch {
    return 0
  }
}

export default async function CompetitorsPage() {
  const session = await auth()
  const userId = session?.user?.id
  const promptCount = userId ? await getPromptCount(userId) : 0

  return (
    <div className="max-w-4xl mx-auto">
      <CompetitorsManager promptCount={promptCount} />
    </div>
  )
}
