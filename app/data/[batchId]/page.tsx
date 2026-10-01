import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getViewer, canReadBatch } from '@/lib/access'
import { getLabelsForProject } from '@/lib/projects'
import { prisma } from '@/lib/prisma'
import { PLATFORMS, PLATFORM_LABELS } from '@/lib/utils'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getData(batchId: string) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { id: true, name: true, projectId: true },
  })
  if (!batch) return null

  const prompts = await prisma.prompt.findMany({
    where: { batchId },
    orderBy: { createdAt: 'asc' },
    include: { results: true },
  })

  return { batch, prompts }
}

export default async function DataPage({ params }: { params: Promise<{ batchId: string }> }) {
  const viewer = await getViewer()
  if (!viewer) redirect('/login')

  const { batchId } = await params
  if (!(await canReadBatch(viewer, batchId))) notFound()
  const data = await getData(batchId)
  if (!data) notFound()

  const { batch, prompts } = data
  const labels = await getLabelsForProject(batch.projectId)

  return (
    <div className="min-h-screen bg-(--c-surface)">
      <div className="px-6 py-4 bg-white border-b border-(--c-line) flex items-center gap-3">
        <Link href="/run" className="text-(--c-muted) hover:text-(--c-ink) transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-(--c-ink)">{batch.name}</h1>
          <p className="text-xs text-(--c-muted)">{prompts.length} prompts · {PLATFORMS.length} platforms</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-max w-full text-xs border-collapse">
          <thead>
            <tr className="bg-(--c-ink) text-white">
              <th className="sticky left-0 z-10 bg-(--c-ink) text-left px-3 py-2.5 font-semibold min-w-[280px]">Prompt</th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[140px]">{labels.entity}</th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[100px]">Category</th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[80px]">Type</th>
              {PLATFORMS.map((p) => (
                <th key={p} colSpan={3} className="text-center px-3 py-2.5 font-semibold border-l border-(--c-accent) min-w-[340px]">
                  {PLATFORM_LABELS[p]}
                </th>
              ))}
            </tr>
            <tr className="bg-(--c-ink-soft) text-white text-[11px]">
              <th className="sticky left-0 z-10 bg-(--c-ink-soft) px-3 py-1.5" />
              <th className="px-3 py-1.5" />
              <th className="px-3 py-1.5" />
              <th className="px-3 py-1.5" />
              {PLATFORMS.map((p) => (
                <>
                  <th key={`${p}-ans`} className="text-left px-3 py-1.5 border-l border-(--c-accent) font-medium min-w-[200px]">Answer</th>
                  <th key={`${p}-men`} className="text-center px-3 py-1.5 font-medium min-w-[70px]">Mentioned</th>
                  <th key={`${p}-cit`} className="text-center px-3 py-1.5 font-medium min-w-[70px]">Cited</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {prompts.map((prompt, i) => {
              const resultsByPlatform = Object.fromEntries(
                prompt.results.map((r) => [r.platform, r])
              )
              return (
                <tr
                  key={prompt.id}
                  className={i % 2 === 0 ? 'bg-white' : 'bg-(--c-surface)'}
                >
                  <td className={`sticky left-0 z-10 px-3 py-2 align-top font-medium text-(--c-ink) border-b border-(--c-line) ${i % 2 === 0 ? 'bg-white' : 'bg-(--c-surface)'}`}>
                    <Link href={`/results/${prompt.id}`} className="hover:underline">
                      {prompt.promptText}
                    </Link>
                  </td>
                  <td className="px-3 py-2 align-top text-(--c-text) border-b border-(--c-line)">{prompt.communityName}</td>
                  <td className="px-3 py-2 align-top text-(--c-muted) border-b border-(--c-line)">{prompt.category}</td>
                  <td className="px-3 py-2 align-top border-b border-(--c-line)">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${prompt.promptType === 'brand' ? 'bg-(--c-ink) text-white' : 'bg-(--c-highlight) text-(--c-ink)'}`}>
                      {prompt.promptType}
                    </span>
                  </td>
                  {PLATFORMS.map((platform) => {
                    const r = resultsByPlatform[platform]
                    const isError = r?.responseText?.startsWith('[Error]')
                    const isNoAIO = r?.responseText?.startsWith('[No AI Overview]')
                    return (
                      <>
                        <td key={`${prompt.id}-${platform}-ans`} className="px-3 py-2 align-top border-b border-l border-(--c-line) max-w-[200px]">
                          {r ? (
                            isNoAIO ? (
                              <span className="text-(--c-subtle) italic">No AI Overview</span>
                            ) : isError ? (
                              <span className="text-rose-500 italic">{r.responseText.slice(0, 80)}</span>
                            ) : (
                              <span className="text-(--c-text) line-clamp-3">{r.responseText}</span>
                            )
                          ) : (
                            <span className="text-(--c-subtle) italic">not run</span>
                          )}
                        </td>
                        <td key={`${prompt.id}-${platform}-men`} className="px-3 py-2 align-top text-center border-b border-(--c-line)">
                          {r && !isError && !isNoAIO ? (
                            <span className={`font-bold ${r.isMentioned ? 'text-emerald-600' : 'text-(--c-line-strong-3)'}`}>
                              {r.isMentioned ? '✓' : '✗'}
                            </span>
                          ) : null}
                        </td>
                        <td key={`${prompt.id}-${platform}-cit`} className="px-3 py-2 align-top text-center border-b border-(--c-line)">
                          {r && !isError && !isNoAIO ? (
                            <span className={`font-bold ${r.isCited ? 'text-emerald-600' : 'text-(--c-line-strong-3)'}`}>
                              {r.isCited ? '✓' : '✗'}
                            </span>
                          ) : null}
                        </td>
                      </>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
