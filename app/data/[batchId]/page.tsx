import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLATFORMS, PLATFORM_LABELS } from '@/lib/utils'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getData(batchId: string, userId: string, userEmail: string | null | undefined) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { id: true, name: true, userId: true, shares: { select: { email: true } } },
  })
  if (!batch) return null

  const canAccess =
    batch.userId === userId ||
    batch.shares.some((s) => s.email === userEmail)
  if (!canAccess) return null

  const prompts = await prisma.prompt.findMany({
    where: { batchId },
    orderBy: { createdAt: 'asc' },
    include: { results: true },
  })

  return { batch, prompts }
}

export default async function DataPage({ params }: { params: Promise<{ batchId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { batchId } = await params
  const data = await getData(batchId, session.user.id, session.user.email)
  if (!data) notFound()

  const { batch, prompts } = data

  return (
    <div className="min-h-screen bg-[#f5f8fa]">
      <div className="px-6 py-4 bg-white border-b border-[#dde6ea] flex items-center gap-3">
        <Link href="/run" className="text-[#5a7a85] hover:text-[#084c61] transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-[#084c61]">{batch.name}</h1>
          <p className="text-xs text-[#5a7a85]">{prompts.length} prompts · {PLATFORMS.length} platforms</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-max w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#084c61] text-white">
              <th className="sticky left-0 z-10 bg-[#084c61] text-left px-3 py-2.5 font-semibold min-w-[280px]">Prompt</th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[140px]">Community</th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[100px]">Category</th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[80px]">Type</th>
              {PLATFORMS.map((p) => (
                <th key={p} colSpan={3} className="text-center px-3 py-2.5 font-semibold border-l border-[#177e89] min-w-[340px]">
                  {PLATFORM_LABELS[p]}
                </th>
              ))}
            </tr>
            <tr className="bg-[#0a5c75] text-white text-[11px]">
              <th className="sticky left-0 z-10 bg-[#0a5c75] px-3 py-1.5" />
              <th className="px-3 py-1.5" />
              <th className="px-3 py-1.5" />
              <th className="px-3 py-1.5" />
              {PLATFORMS.map((p) => (
                <>
                  <th key={`${p}-ans`} className="text-left px-3 py-1.5 border-l border-[#177e89] font-medium min-w-[200px]">Answer</th>
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
                  className={i % 2 === 0 ? 'bg-white' : 'bg-[#f5f8fa]'}
                >
                  <td className={`sticky left-0 z-10 px-3 py-2 align-top font-medium text-[#084c61] border-b border-[#dde6ea] ${i % 2 === 0 ? 'bg-white' : 'bg-[#f5f8fa]'}`}>
                    <Link href={`/results/${prompt.id}`} className="hover:underline">
                      {prompt.promptText}
                    </Link>
                  </td>
                  <td className="px-3 py-2 align-top text-[#1a1a1a] border-b border-[#dde6ea]">{prompt.communityName}</td>
                  <td className="px-3 py-2 align-top text-[#5a7a85] border-b border-[#dde6ea]">{prompt.category}</td>
                  <td className="px-3 py-2 align-top border-b border-[#dde6ea]">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${prompt.promptType === 'brand' ? 'bg-[#084c61] text-white' : 'bg-[#ffc857] text-[#084c61]'}`}>
                      {prompt.promptType}
                    </span>
                  </td>
                  {PLATFORMS.map((platform) => {
                    const r = resultsByPlatform[platform]
                    const isError = r?.responseText?.startsWith('[Error]')
                    return (
                      <>
                        <td key={`${prompt.id}-${platform}-ans`} className="px-3 py-2 align-top border-b border-l border-[#dde6ea] max-w-[200px]">
                          {r ? (
                            isError ? (
                              <span className="text-rose-500 italic">{r.responseText.slice(0, 80)}</span>
                            ) : (
                              <span className="text-[#1a1a1a] line-clamp-3">{r.responseText}</span>
                            )
                          ) : (
                            <span className="text-[#8aadb8] italic">not run</span>
                          )}
                        </td>
                        <td key={`${prompt.id}-${platform}-men`} className="px-3 py-2 align-top text-center border-b border-[#dde6ea]">
                          {r && !isError ? (
                            <span className={`font-bold ${r.isMentioned ? 'text-emerald-600' : 'text-[#c0cfd6]'}`}>
                              {r.isMentioned ? '✓' : '✗'}
                            </span>
                          ) : null}
                        </td>
                        <td key={`${prompt.id}-${platform}-cit`} className="px-3 py-2 align-top text-center border-b border-[#dde6ea]">
                          {r && !isError ? (
                            <span className={`font-bold ${r.isCited ? 'text-emerald-600' : 'text-[#c0cfd6]'}`}>
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
