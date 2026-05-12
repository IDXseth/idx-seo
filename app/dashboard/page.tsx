import { prisma } from '@/lib/prisma'
import { PLATFORMS, formatPercent } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Scorecard } from '@/components/scorecard'
import { PlatformMentionChart } from '@/components/platform-chart'
import { slugify } from '@/lib/utils'
import { BarChart3, Target, Quote, Layers, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getDashboardData() {
  const [totalPrompts, totalResults, mentionedResults, citedResults] = await Promise.all([
    prisma.prompt.count(),
    prisma.result.count(),
    prisma.result.count({ where: { isMentioned: true } }),
    prisma.result.count({ where: { isCited: true } }),
  ])

  const platformStats = await Promise.all(
    PLATFORMS.map(async (platform) => {
      const [total, mentioned, cited] = await Promise.all([
        prisma.result.count({ where: { platform } }),
        prisma.result.count({ where: { platform, isMentioned: true } }),
        prisma.result.count({ where: { platform, isCited: true } }),
      ])
      return {
        platform,
        total,
        mentioned,
        cited,
        mentionRate: total > 0 ? mentioned / total : 0,
        citationRate: total > 0 ? cited / total : 0,
      }
    })
  )

  const communityGroups = await prisma.prompt.groupBy({ by: ['communityName', 'city'], _count: { id: true } })
  const communityStats = await Promise.all(
    communityGroups.map(async (c) => {
      const results = await prisma.result.findMany({
        where: { prompt: { communityName: c.communityName } },
        select: { isMentioned: true, isCited: true },
      })
      const total = results.length
      return {
        communityName: c.communityName,
        city: c.city,
        promptCount: c._count.id,
        mentionRate: total > 0 ? results.filter((r) => r.isMentioned).length / total : 0,
        citationRate: total > 0 ? results.filter((r) => r.isCited).length / total : 0,
      }
    })
  )

  const categoryGroups = await prisma.prompt.groupBy({ by: ['category'], _count: { id: true } })
  const categoryStats = await Promise.all(
    categoryGroups.filter((c) => c.category).map(async (c) => {
      const results = await prisma.result.findMany({
        where: { prompt: { category: c.category } },
        select: { isMentioned: true, isCited: true },
      })
      const total = results.length
      return {
        category: c.category,
        promptCount: c._count.id,
        mentionRate: total > 0 ? results.filter((r) => r.isMentioned).length / total : 0,
        citationRate: total > 0 ? results.filter((r) => r.isCited).length / total : 0,
      }
    })
  )

  const careLevelGroups = await prisma.prompt.groupBy({ by: ['levelOfCare'], _count: { id: true } })
  const careLevelStats = await Promise.all(
    careLevelGroups.filter((c) => c.levelOfCare).map(async (c) => {
      const results = await prisma.result.findMany({
        where: { prompt: { levelOfCare: c.levelOfCare } },
        select: { isMentioned: true, isCited: true },
      })
      const total = results.length
      return {
        levelOfCare: c.levelOfCare,
        promptCount: c._count.id,
        mentionRate: total > 0 ? results.filter((r) => r.isMentioned).length / total : 0,
        citationRate: total > 0 ? results.filter((r) => r.isCited).length / total : 0,
      }
    })
  )

  const marketGroups = await prisma.prompt.groupBy({ by: ['market'], _count: { id: true } })
  const marketStats = await Promise.all(
    marketGroups.filter((m) => m.market).map(async (m) => {
      const results = await prisma.result.findMany({
        where: { prompt: { market: m.market } },
        select: { isMentioned: true, isCited: true },
      })
      const total = results.length
      return {
        market: m.market,
        promptCount: m._count.id,
        mentionRate: total > 0 ? results.filter((r) => r.isMentioned).length / total : 0,
        citationRate: total > 0 ? results.filter((r) => r.isCited).length / total : 0,
      }
    })
  )

  return {
    overview: {
      totalPrompts,
      totalResults,
      overallMentionRate: totalResults > 0 ? mentionedResults / totalResults : 0,
      overallCitationRate: totalResults > 0 ? citedResults / totalResults : 0,
    },
    platformStats,
    communityStats,
    categoryStats,
    careLevelStats,
    marketStats,
  }
}

export default async function DashboardPage() {
  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null
  try {
    data = await getDashboardData()
  } catch {
    // DB not configured — show empty state
  }

  if (!data || data.overview.totalPrompts === 0) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#084c61]" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>Dashboard</h1>
          <p className="text-[#5a7a85] mt-1 text-sm">AI mention and citation monitoring across your senior living portfolio</p>
        </div>
        <EmptyDashboard />
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#084c61]" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>Dashboard</h1>
        <p className="text-[#5a7a85] mt-1 text-sm">AI mention and citation monitoring across your senior living portfolio</p>
      </div>

      <>
          {/* Hero stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<BarChart3 className="h-5 w-5 text-[#084c61]" />}
              iconBg="bg-[#e6f2f5]"
              label="Prompts Analyzed"
              value={data.overview.totalPrompts.toLocaleString()}
            />
            <StatCard
              icon={<Target className="h-5 w-5 text-emerald-600" />}
              iconBg="bg-emerald-50"
              label="Overall Mention Rate"
              value={formatPercent(data.overview.overallMentionRate)}
              subtext={rateLabel(data.overview.overallMentionRate)}
              subtextColor={rateTextColor(data.overview.overallMentionRate)}
            />
            <StatCard
              icon={<Quote className="h-5 w-5 text-[#177e89]" />}
              iconBg="bg-[#e6f2f5]"
              label="Overall Citation Rate"
              value={formatPercent(data.overview.overallCitationRate)}
              subtext={rateLabel(data.overview.overallCitationRate)}
              subtextColor={rateTextColor(data.overview.overallCitationRate)}
            />
            <StatCard
              icon={<Layers className="h-5 w-5 text-[#084c61]" />}
              iconBg="bg-[#e6f2f5]"
              label="Platforms Monitored"
              value={String(PLATFORMS.length)}
              subtext="AI platforms"
            />
          </div>

          {/* Tabbed views */}
          <Tabs defaultValue="overview">
            <TabsList className="mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="community">By Community</TabsTrigger>
              <TabsTrigger value="category">By Category</TabsTrigger>
              <TabsTrigger value="careLevel">By Level of Care</TabsTrigger>
              <TabsTrigger value="market">By Market</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <SectionCard title="Mention & Citation Rate by Platform">
                <PlatformMentionChart data={data.platformStats} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="community">
              <TabGrid
                items={data.communityStats}
                renderCard={(c) => (
                  <Scorecard
                    key={c.communityName}
                    title={c.communityName}
                    subtitle={c.city}
                    mentionRate={c.mentionRate}
                    citationRate={c.citationRate}
                    promptCount={c.promptCount}
                    href={`/dashboard/community/${encodeURIComponent(slugify(c.communityName))}`}
                  />
                )}
                empty="No community data available"
              />
            </TabsContent>

            <TabsContent value="category">
              <TabGrid
                items={data.categoryStats}
                renderCard={(c) => (
                  <Scorecard
                    key={c.category}
                    title={c.category}
                    mentionRate={c.mentionRate}
                    citationRate={c.citationRate}
                    promptCount={c.promptCount}
                    href={`/dashboard/category/${encodeURIComponent(c.category)}`}
                  />
                )}
                empty="No category data available"
              />
            </TabsContent>

            <TabsContent value="careLevel">
              <TabGrid
                items={data.careLevelStats}
                renderCard={(c) => (
                  <Scorecard
                    key={c.levelOfCare}
                    title={c.levelOfCare}
                    mentionRate={c.mentionRate}
                    citationRate={c.citationRate}
                    promptCount={c.promptCount}
                    href={`/dashboard/care-level/${encodeURIComponent(c.levelOfCare)}`}
                  />
                )}
                empty="No care level data available"
              />
            </TabsContent>

            <TabsContent value="market">
              <TabGrid
                items={data.marketStats}
                renderCard={(m) => (
                  <Scorecard
                    key={m.market}
                    title={m.market}
                    mentionRate={m.mentionRate}
                    citationRate={m.citationRate}
                    promptCount={m.promptCount}
                    href={`/dashboard/market/${encodeURIComponent(m.market)}`}
                  />
                )}
                empty="No market data available"
              />
            </TabsContent>
          </Tabs>
      </>
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function StatCard({
  icon,
  iconBg,
  label,
  value,
  subtext,
  subtextColor,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
  subtext?: string
  subtextColor?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-[#dde6ea] p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
        <p className="text-xs font-medium text-[#5a7a85]">{label}</p>
      </div>
      <p className="text-3xl font-bold text-[#084c61] leading-none">{value}</p>
      {subtext && (
        <p className={`text-xs mt-1.5 font-medium ${subtextColor ?? 'text-[#8aadb8]'}`}>{subtext}</p>
      )}
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#dde6ea] p-6">
      <h2 className="text-sm font-semibold text-[#084c61] mb-4">{title}</h2>
      {children}
    </div>
  )
}

function TabGrid<T>({
  items,
  renderCard,
  empty,
}: {
  items: T[]
  renderCard: (item: T) => React.ReactNode
  empty: string
}) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#dde6ea] py-12 text-center">
        <p className="text-[#8aadb8] text-sm">{empty}</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map(renderCard)}
    </div>
  )
}

function EmptyDashboard() {
  return (
    <div className="bg-white rounded-2xl border border-[#dde6ea] overflow-hidden">
      {/* Decorative gradient header */}
      <div className="px-8 py-12 text-center" style={{ background: 'linear-gradient(135deg, #084c61 0%, #054166 100%)' }}>
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white/10 backdrop-blur mb-4">
          <BarChart3 className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>No data yet</h2>
        <p className="text-white/70 text-sm max-w-sm mx-auto">
          Upload your prompts spreadsheet and run it against 6 AI platforms to see your mention and citation performance.
        </p>
      </div>

      {/* Steps */}
      <div className="px-8 py-8">
        <p className="text-xs font-semibold text-[#8aadb8] uppercase tracking-wider mb-5">Get started in 2 steps</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <StepCard
            step="1"
            title="Upload your prompts"
            description="Upload an .xlsx or .csv file with prompt text, community names, care levels, markets, and categories."
            href="/upload"
            cta="Upload spreadsheet"
          />
          <StepCard
            step="2"
            title="Run the prompts"
            description="We'll send every prompt to ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews, and AI Mode."
            href="/run"
            cta="Run prompts"
          />
        </div>
      </div>
    </div>
  )
}

function StepCard({
  step,
  title,
  description,
  href,
  cta,
}: {
  step: string
  title: string
  description: string
  href: string
  cta: string
}) {
  return (
    <a
      href={href}
      className="group block p-5 rounded-xl border border-[#dde6ea] hover:border-[#177e89] hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full text-white text-xs font-bold flex-shrink-0" style={{ background: '#084c61' }}>
          {step}
        </span>
        <h3 className="font-semibold text-[#084c61] text-sm">{title}</h3>
      </div>
      <p className="text-xs text-[#5a7a85] leading-relaxed mb-4">{description}</p>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#177e89] group-hover:gap-2.5 transition-all">
        {cta} <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </a>
  )
}

function rateLabel(rate: number) {
  if (rate >= 0.6) return 'High visibility'
  if (rate >= 0.3) return 'Moderate visibility'
  return 'Low visibility'
}

function rateTextColor(rate: number) {
  if (rate >= 0.6) return 'text-emerald-600'
  if (rate >= 0.3) return 'text-amber-600'
  return 'text-rose-500'
}
