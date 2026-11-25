import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { readableBatchWhere, readablePromptWhere, type Viewer } from '../access'
import { canEditProject, readableProjectWhere } from '../projects'
import { resolveSegmentLabels } from '../segment-labels'
import { getVisibilityGaps } from '../competitive'
import { PLATFORMS, PLATFORM_LABELS } from '../utils'

// Read-only MCP tools over the AI Visibility Dashboard. Every query is scoped
// with the same rules the web app uses (lib/access.ts, lib/projects.ts), so a
// connector sees exactly what its signed-in user sees in the dashboard.

export class ToolError extends Error {}

type Args = Record<string, unknown>

interface ToolDef {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (viewer: Viewer, args: Args) => Promise<unknown>
}

// ─── Argument helpers ────────────────────────────────────────────────────────

function str(args: Args, key: string, required = false): string | undefined {
  const v = args[key]
  if (v === undefined || v === null || v === '') {
    if (required) throw new ToolError(`"${key}" is required`)
    return undefined
  }
  if (typeof v !== 'string') throw new ToolError(`"${key}" must be a string`)
  return v
}

function int(args: Args, key: string, fallback: number, min: number, max: number): number {
  const v = args[key]
  if (v === undefined || v === null) return fallback
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) throw new ToolError(`"${key}" must be a number`)
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function promptTypeArg(args: Args): 'brand' | 'nonbrand' | undefined {
  const v = str(args, 'prompt_type')
  if (v === undefined || v === 'all') return undefined
  if (v !== 'brand' && v !== 'nonbrand') throw new ToolError('"prompt_type" must be "brand", "nonbrand" or "all"')
  return v
}

const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 1000 : 0)

// ─── Shared scoping ──────────────────────────────────────────────────────────

interface Scope {
  project: { id: string; name: string; primaryDomain: string; brandLabel: string }
  promptWhere: Prisma.PromptWhereInput
  resultWhere: Prisma.ResultWhereInput
  runSession: { id: string; startedAt: Date } | null
}

async function readableProject(viewer: Viewer, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { AND: [{ id: projectId }, readableProjectWhere(viewer)] },
    select: { id: true, name: true, primaryDomain: true, brandNames: true, segmentLabels: true, userId: true },
  })
  if (!project) throw new ToolError(`Project "${projectId}" not found, or you don't have access. Call list_projects for valid ids.`)
  return project
}

// Prompts the viewer can read in one project, optionally one prompt type and
// one run session ("latest" = the newest finished session with results).
async function buildScope(viewer: Viewer, args: Args): Promise<Scope> {
  const project = await readableProject(viewer, str(args, 'project_id', true)!)
  const promptType = promptTypeArg(args)
  const promptWhere: Prisma.PromptWhereInput = {
    batch: { AND: [readableBatchWhere(viewer), { projectId: project.id }] },
    ...(promptType ? { promptType } : {}),
  }

  let runSession: Scope['runSession'] = null
  const sessionArg = str(args, 'run_session_id')
  if (sessionArg === 'latest') {
    runSession = await prisma.runSession.findFirst({
      where: { status: 'done', results: { some: { prompt: promptWhere } } },
      orderBy: { startedAt: 'desc' },
      select: { id: true, startedAt: true },
    })
    if (!runSession) throw new ToolError('This project has no finished run sessions yet.')
  } else if (sessionArg) {
    runSession = await prisma.runSession.findFirst({
      where: { id: sessionArg, results: { some: { prompt: promptWhere } } },
      select: { id: true, startedAt: true },
    })
    if (!runSession) throw new ToolError(`Run session "${sessionArg}" has no results in this project. Call get_trends for valid ids.`)
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      primaryDomain: project.primaryDomain,
      brandLabel: project.brandNames.find((n) => n.trim()) ?? project.name,
    },
    promptWhere,
    resultWhere: { prompt: promptWhere, ...(runSession ? { runSessionId: runSession.id } : {}) },
    runSession,
  }
}

function scopeInfo(scope: Scope, args: Args) {
  return {
    project: scope.project,
    prompt_type: promptTypeArg(args) ?? 'all',
    run_session: scope.runSession
      ? { id: scope.runSession.id, startedAt: scope.runSession.startedAt.toISOString() }
      : 'all results across every run (pass run_session_id "latest" for the newest snapshot)',
  }
}

// ─── Shared parameter schemas ────────────────────────────────────────────────

const projectIdSchema = { type: 'string', description: 'Project id from list_projects.' }
const promptTypeSchema = {
  type: 'string',
  enum: ['all', 'brand', 'nonbrand'],
  description: 'Brand prompts name the brand; nonbrand prompts never do (shows who AI recommends unprompted). Default all.',
}
const runSessionSchema = {
  type: 'string',
  description: 'A run session id (from get_trends), or "latest". Omit to aggregate every run, as the dashboard does by default.',
}

// ─── Tools ───────────────────────────────────────────────────────────────────

const listProjects: ToolDef = {
  name: 'list_projects',
  title: 'List projects',
  description:
    'Lists the brands (projects) you can see in the AI Visibility Dashboard, with their prompt sets, prompt counts and last run. Call this first to get project ids.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  async handler(viewer) {
    const projects = await prisma.project.findMany({
      where: readableProjectWhere(viewer),
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        primaryDomain: true,
        additionalDomains: true,
        brandNames: true,
        segmentLabels: true,
        userId: true,
        batches: {
          where: readableBatchWhere(viewer),
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            createdAt: true,
            _count: { select: { prompts: true } },
            runSessions: {
              where: { status: 'done' },
              orderBy: { startedAt: 'desc' },
              take: 1,
              select: { startedAt: true },
            },
          },
        },
        competitors: { where: { active: true }, select: { brandName: true } },
      },
    })
    return {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        primaryDomain: p.primaryDomain,
        additionalDomains: p.additionalDomains,
        brandNames: p.brandNames,
        segmentLabels: resolveSegmentLabels(p.segmentLabels),
        youCanEdit: canEditProject(viewer, p),
        trackedCompetitors: p.competitors.map((c) => c.brandName),
        promptSets: p.batches.map((b) => ({
          id: b.id,
          name: b.name,
          promptCount: b._count.prompts,
          createdAt: b.createdAt.toISOString(),
          lastRunAt: b.runSessions[0]?.startedAt.toISOString() ?? null,
        })),
      })),
      platforms: PLATFORMS.map((p) => ({ id: p, label: PLATFORM_LABELS[p] })),
    }
  },
}

const visibilitySummary: ToolDef = {
  name: 'get_visibility_summary',
  title: 'Visibility summary',
  description:
    "A project's headline AI visibility: how often the brand is mentioned and cited across AI platforms (ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews), sentiment of those mentions, average position among tracked brands, a per-platform breakdown, and the same rates for each tracked competitor.",
  inputSchema: {
    type: 'object',
    properties: { project_id: projectIdSchema, prompt_type: promptTypeSchema, run_session_id: runSessionSchema },
    required: ['project_id'],
    additionalProperties: false,
  },
  async handler(viewer, args) {
    const scope = await buildScope(viewer, args)
    const [promptCount, results] = await Promise.all([
      prisma.prompt.count({ where: scope.promptWhere }),
      prisma.result.findMany({
        where: scope.resultWhere,
        select: {
          platform: true,
          isMentioned: true,
          isCited: true,
          sentiment: true,
          brandPosition: true,
          competitorMentions: {
            where: { competitor: { active: true } },
            select: { competitorId: true, isMentioned: true, isCited: true, sentiment: true, competitor: { select: { brandName: true } } },
          },
        },
      }),
    ])

    type Tally = { total: number; mentioned: number; cited: number; positive: number; neutral: number; negative: number; positions: number[] }
    const empty = (): Tally => ({ total: 0, mentioned: 0, cited: 0, positive: 0, neutral: 0, negative: 0, positions: [] })
    const add = (t: Tally, f: { isMentioned: boolean; isCited: boolean; sentiment: string }, position?: number | null) => {
      t.total++
      if (f.isCited) t.cited++
      if (!f.isMentioned) return
      t.mentioned++
      if (f.sentiment === 'positive') t.positive++
      else if (f.sentiment === 'negative') t.negative++
      else t.neutral++
      if (position) t.positions.push(position)
    }
    const summarize = (t: Tally) => ({
      responses: t.total,
      mentioned: t.mentioned,
      cited: t.cited,
      mentionRate: rate(t.mentioned, t.total),
      citationRate: rate(t.cited, t.total),
      // Sentiment is rated against mentions, as the dashboard does.
      sentimentOfMentions: { positive: rate(t.positive, t.mentioned), neutral: rate(t.neutral, t.mentioned), negative: rate(t.negative, t.mentioned) },
      averagePosition: t.positions.length ? Math.round((t.positions.reduce((a, b) => a + b, 0) / t.positions.length) * 10) / 10 : null,
    })

    const brand = empty()
    const byPlatform = new Map<string, Tally>(PLATFORMS.map((p) => [p, empty()]))
    const competitors = new Map<string, { name: string; tally: Tally }>()

    for (const r of results) {
      add(brand, r, r.brandPosition)
      const pt = byPlatform.get(r.platform) ?? byPlatform.set(r.platform, empty()).get(r.platform)!
      add(pt, r, r.brandPosition)
      for (const m of r.competitorMentions) {
        let c = competitors.get(m.competitorId)
        if (!c) competitors.set(m.competitorId, (c = { name: m.competitor.brandName, tally: empty() }))
        add(c.tally, m)
      }
    }

    return {
      scope: scopeInfo(scope, args),
      promptCount,
      brand: { name: scope.project.brandLabel, ...summarize(brand) },
      byPlatform: [...byPlatform.entries()].map(([platform, t]) => ({ platform, label: PLATFORM_LABELS[platform] ?? platform, ...summarize(t) })),
      competitors: [...competitors.entries()]
        .map(([id, c]) => ({ id, name: c.name, ...summarize(c.tally) }))
        .sort((a, b) => b.mentionRate - a.mentionRate),
    }
  },
}

const DIMENSIONS = ['category', 'entity', 'market', 'city', 'level_of_care', 'platform'] as const
type Dimension = (typeof DIMENSIONS)[number]

const segmentBreakdown: ToolDef = {
  name: 'get_segment_breakdown',
  title: 'Breakdown by segment',
  description:
    'Mention and citation rates grouped by one dimension: category, entity (the community/location/product a prompt is about), market, city, level_of_care (service line), or platform. Use it to find the weakest or strongest segments.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: projectIdSchema,
      dimension: { type: 'string', enum: [...DIMENSIONS] },
      prompt_type: promptTypeSchema,
      run_session_id: runSessionSchema,
    },
    required: ['project_id', 'dimension'],
    additionalProperties: false,
  },
  async handler(viewer, args) {
    const dimension = str(args, 'dimension', true) as Dimension
    if (!DIMENSIONS.includes(dimension)) throw new ToolError(`"dimension" must be one of ${DIMENSIONS.join(', ')}`)
    const scope = await buildScope(viewer, args)
    const results = await prisma.result.findMany({
      where: scope.resultWhere,
      select: {
        platform: true,
        isMentioned: true,
        isCited: true,
        promptId: true,
        prompt: {
          select: { category: true, entityName: true, communityName: true, market: true, city: true, levelOfCare: true, segments: true },
        },
      },
    })

    const keyOf = (r: (typeof results)[number]): string => {
      const p = r.prompt
      const seg = (p.segments && typeof p.segments === 'object' ? p.segments : {}) as Record<string, unknown>
      const s = (k: string) => (typeof seg[k] === 'string' ? (seg[k] as string) : '')
      switch (dimension) {
        case 'category': return p.category
        case 'entity': return p.entityName || p.communityName
        case 'market': return s('market') || p.market
        case 'city': return s('city') || p.city
        case 'level_of_care': return s('levelOfCare') || p.levelOfCare
        case 'platform': return PLATFORM_LABELS[r.platform] ?? r.platform
      }
    }

    const groups = new Map<string, { prompts: Set<string>; total: number; mentioned: number; cited: number }>()
    for (const r of results) {
      const key = keyOf(r) || '(none)'
      let g = groups.get(key)
      if (!g) groups.set(key, (g = { prompts: new Set(), total: 0, mentioned: 0, cited: 0 }))
      g.prompts.add(r.promptId)
      g.total++
      if (r.isMentioned) g.mentioned++
      if (r.isCited) g.cited++
    }

    return {
      scope: scopeInfo(scope, args),
      dimension,
      segments: [...groups.entries()]
        .map(([value, g]) => ({
          value,
          prompts: g.prompts.size,
          responses: g.total,
          mentionRate: rate(g.mentioned, g.total),
          citationRate: rate(g.cited, g.total),
        }))
        .sort((a, b) => b.responses - a.responses),
    }
  },
}

const trends: ToolDef = {
  name: 'get_trends',
  title: 'Trends over time',
  description:
    "Mention, citation and sentiment rates for each finished run session (snapshot) of a project, oldest first, with per-platform mention rates. Also the way to find run session ids.",
  inputSchema: {
    type: 'object',
    properties: { project_id: projectIdSchema, prompt_type: promptTypeSchema },
    required: ['project_id'],
    additionalProperties: false,
  },
  async handler(viewer, args) {
    const scope = await buildScope(viewer, { ...args, run_session_id: undefined })
    const results = await prisma.result.findMany({
      where: { prompt: scope.promptWhere, runSession: { status: 'done' } },
      select: {
        platform: true,
        isMentioned: true,
        isCited: true,
        sentiment: true,
        runSession: { select: { id: true, startedAt: true, triggeredBy: true } },
      },
    })

    type T = { startedAt: Date; triggeredBy: string; total: number; mentioned: number; cited: number; positive: number; negative: number; platforms: Map<string, { total: number; mentioned: number }> }
    const sessions = new Map<string, T>()
    for (const r of results) {
      if (!r.runSession) continue
      let s = sessions.get(r.runSession.id)
      if (!s) {
        sessions.set(r.runSession.id, (s = {
          startedAt: r.runSession.startedAt,
          triggeredBy: r.runSession.triggeredBy,
          total: 0, mentioned: 0, cited: 0, positive: 0, negative: 0,
          platforms: new Map(),
        }))
      }
      s.total++
      if (r.isCited) s.cited++
      if (r.isMentioned) {
        s.mentioned++
        if (r.sentiment === 'positive') s.positive++
        if (r.sentiment === 'negative') s.negative++
      }
      const p = s.platforms.get(r.platform) ?? s.platforms.set(r.platform, { total: 0, mentioned: 0 }).get(r.platform)!
      p.total++
      if (r.isMentioned) p.mentioned++
    }

    return {
      scope: { project: scope.project, prompt_type: promptTypeArg(args) ?? 'all' },
      runSessions: [...sessions.entries()]
        .sort((a, b) => a[1].startedAt.getTime() - b[1].startedAt.getTime())
        .map(([id, s]) => ({
          runSessionId: id,
          startedAt: s.startedAt.toISOString(),
          triggeredBy: s.triggeredBy,
          responses: s.total,
          mentionRate: rate(s.mentioned, s.total),
          citationRate: rate(s.cited, s.total),
          positiveRateOfMentions: rate(s.positive, s.mentioned),
          negativeRateOfMentions: rate(s.negative, s.mentioned),
          mentionRateByPlatform: Object.fromEntries([...s.platforms.entries()].map(([k, v]) => [k, rate(v.mentioned, v.total)])),
        })),
    }
  },
}

const listPrompts: ToolDef = {
  name: 'list_prompts',
  title: 'List prompts',
  description:
    'Lists the prompts tracked in a project with their tags and how often the brand was mentioned/cited for each. Filter by type, category, entity or a text search. Use get_prompt_results for the actual AI answers.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: projectIdSchema,
      prompt_type: promptTypeSchema,
      run_session_id: runSessionSchema,
      category: { type: 'string', description: 'Exact category name.' },
      entity: { type: 'string', description: 'Exact entity (community/location/product) name.' },
      search: { type: 'string', description: 'Case-insensitive text to look for in the prompt.' },
      limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      offset: { type: 'integer', minimum: 0, default: 0 },
    },
    required: ['project_id'],
    additionalProperties: false,
  },
  async handler(viewer, args) {
    const scope = await buildScope(viewer, args)
    const category = str(args, 'category')
    const entity = str(args, 'entity')
    const search = str(args, 'search')
    const limit = int(args, 'limit', 50, 1, 200)
    const offset = int(args, 'offset', 0, 0, 1_000_000)

    const where: Prisma.PromptWhereInput = {
      AND: [
        scope.promptWhere,
        ...(category ? [{ category }] : []),
        ...(entity ? [{ OR: [{ entityName: entity }, { communityName: entity }] }] : []),
        ...(search ? [{ promptText: { contains: search, mode: 'insensitive' as const } }] : []),
      ],
    }
    const [total, prompts] = await Promise.all([
      prisma.prompt.count({ where }),
      prisma.prompt.findMany({
        where,
        orderBy: [{ category: 'asc' }, { promptText: 'asc' }],
        skip: offset,
        take: limit,
        select: {
          id: true,
          promptText: true,
          promptType: true,
          category: true,
          entityName: true,
          communityName: true,
          market: true,
          city: true,
          levelOfCare: true,
          jobStatus: true,
          batch: { select: { name: true } },
          results: {
            where: scope.runSession ? { runSessionId: scope.runSession.id } : {},
            select: { isMentioned: true, isCited: true },
          },
        },
      }),
    ])

    return {
      scope: scopeInfo(scope, args),
      total,
      offset,
      returned: prompts.length,
      prompts: prompts.map((p) => {
        const mentioned = p.results.filter((r) => r.isMentioned).length
        const cited = p.results.filter((r) => r.isCited).length
        return {
          id: p.id,
          prompt: p.promptText,
          type: p.promptType,
          category: p.category,
          entity: p.entityName || p.communityName,
          market: p.market || undefined,
          city: p.city || undefined,
          levelOfCare: p.levelOfCare || undefined,
          promptSet: p.batch.name,
          status: p.jobStatus,
          responses: p.results.length,
          mentionRate: rate(mentioned, p.results.length),
          citationRate: rate(cited, p.results.length),
        }
      }),
    }
  },
}

const promptResults: ToolDef = {
  name: 'get_prompt_results',
  title: 'AI answers for a prompt',
  description:
    "The actual answer each AI platform gave for one prompt: whether the brand was mentioned or cited, sentiment, position, cited sources, and each tracked competitor's mention/citation on the same answer. Defaults to each platform's most recent answer.",
  inputSchema: {
    type: 'object',
    properties: {
      prompt_id: { type: 'string', description: 'Prompt id from list_prompts or get_visibility_gaps.' },
      run_session_id: { type: 'string', description: 'Show answers from this run session instead of the latest per platform.' },
      max_chars: { type: 'integer', minimum: 200, maximum: 20000, default: 4000, description: 'Truncate each answer to this many characters.' },
    },
    required: ['prompt_id'],
    additionalProperties: false,
  },
  async handler(viewer, args) {
    const promptId = str(args, 'prompt_id', true)!
    const runSessionId = str(args, 'run_session_id')
    const maxChars = int(args, 'max_chars', 4000, 200, 20000)

    const prompt = await prisma.prompt.findFirst({
      where: { AND: [{ id: promptId }, readablePromptWhere(viewer)] },
      select: {
        id: true, promptText: true, promptType: true, category: true, entityName: true, communityName: true,
        market: true, city: true, levelOfCare: true,
        batch: { select: { name: true, project: { select: { id: true, name: true } } } },
      },
    })
    if (!prompt) throw new ToolError(`Prompt "${promptId}" not found, or you don't have access.`)

    const results = await prisma.result.findMany({
      where: { promptId, ...(runSessionId ? { runSessionId } : {}) },
      orderBy: { runAt: 'desc' },
      select: {
        platform: true, runAt: true, runSessionId: true, responseText: true, isMentioned: true, isCited: true,
        sentiment: true, brandPosition: true,
        citations: { select: { url: true, title: true, domain: true, isExplicitCitation: true } },
        competitorMentions: {
          where: { competitor: { active: true } },
          select: { isMentioned: true, isCited: true, sentiment: true, position: true, competitor: { select: { brandName: true } } },
        },
      },
    })

    // Latest answer per platform unless a session was asked for.
    const seen = new Set<string>()
    const picked = runSessionId ? results : results.filter((r) => (seen.has(r.platform) ? false : (seen.add(r.platform), true)))

    return {
      prompt: {
        id: prompt.id,
        prompt: prompt.promptText,
        type: prompt.promptType,
        category: prompt.category,
        entity: prompt.entityName || prompt.communityName,
        market: prompt.market || undefined,
        city: prompt.city || undefined,
        levelOfCare: prompt.levelOfCare || undefined,
        promptSet: prompt.batch.name,
        project: prompt.batch.project,
      },
      answers: picked.map((r) => ({
        platform: PLATFORM_LABELS[r.platform] ?? r.platform,
        runAt: r.runAt.toISOString(),
        runSessionId: r.runSessionId,
        brandMentioned: r.isMentioned,
        brandCited: r.isCited,
        sentiment: r.isMentioned ? r.sentiment : null,
        brandPosition: r.brandPosition,
        competitors: r.competitorMentions
          .filter((m) => m.isMentioned || m.isCited)
          .map((m) => ({ name: m.competitor.brandName, mentioned: m.isMentioned, cited: m.isCited, sentiment: m.sentiment, position: m.position })),
        citedSources: r.citations.filter((c) => c.isExplicitCitation).map((c) => ({ title: c.title, url: c.url, domain: c.domain })),
        otherRetrievedSources: r.citations.filter((c) => !c.isExplicitCitation).length,
        answer: r.responseText.length > maxChars ? `${r.responseText.slice(0, maxChars)}… [truncated, ${r.responseText.length} chars total]` : r.responseText,
      })),
    }
  },
}

const topCitedDomains: ToolDef = {
  name: 'get_top_cited_domains',
  title: 'Most-cited sources',
  description:
    "The websites AI platforms cite most often in answers to a project's prompts, flagged as the brand's own domain, a tracked competitor's, or third party. Shows which sources shape AI answers.",
  inputSchema: {
    type: 'object',
    properties: {
      project_id: projectIdSchema,
      prompt_type: promptTypeSchema,
      run_session_id: runSessionSchema,
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
    },
    required: ['project_id'],
    additionalProperties: false,
  },
  async handler(viewer, args) {
    const scope = await buildScope(viewer, args)
    const limit = int(args, 'limit', 25, 1, 100)
    const [project, competitors, groups] = await Promise.all([
      prisma.project.findUnique({ where: { id: scope.project.id }, select: { primaryDomain: true, additionalDomains: true } }),
      prisma.competitor.findMany({ where: { projectId: scope.project.id, active: true }, select: { brandName: true, domain: true } }),
      prisma.citation.groupBy({
        by: ['domain'],
        where: { isExplicitCitation: true, result: scope.resultWhere },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: limit,
      }),
    ])

    const bare = (d: string) => d.toLowerCase().replace(/^www\./, '')
    const matches = (domain: string, owned: string) => {
      const d = bare(domain)
      const o = bare(owned)
      return !!o && (d === o || d.endsWith(`.${o}`))
    }
    const own = [project?.primaryDomain ?? '', ...(project?.additionalDomains ?? [])].filter(Boolean)

    return {
      scope: scopeInfo(scope, args),
      domains: groups.map((g) => {
        const competitor = competitors.find((c) => matches(g.domain, c.domain))
        return {
          domain: g.domain,
          citations: g._count.id,
          owner: own.some((o) => matches(g.domain, o)) ? 'brand' : competitor ? `competitor: ${competitor.brandName}` : 'third party',
        }
      }),
    }
  },
}

const visibilityGaps: ToolDef = {
  name: 'get_visibility_gaps',
  title: 'Visibility gaps',
  description:
    'Prompts where at least one tracked competitor was mentioned but the brand was not, ranked by how many answers had that gap. The clearest list of where to win AI visibility back.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: projectIdSchema,
      prompt_type: promptTypeSchema,
      run_session_id: runSessionSchema,
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
    required: ['project_id'],
    additionalProperties: false,
  },
  async handler(viewer, args) {
    const scope = await buildScope(viewer, args)
    const gaps = await getVisibilityGaps(scope.resultWhere, int(args, 'limit', 20, 1, 100))
    return {
      scope: scopeInfo(scope, args),
      gaps: gaps.map((g) => ({
        promptId: g.promptId,
        prompt: g.promptText,
        entity: g.entityName,
        answersWithGap: g.gapResponses,
        totalAnswers: g.totalResponses,
        competitorsMentioned: g.competitors.map((c) => ({ name: c.brandName, answers: c.count })),
      })),
    }
  },
}

const listCompetitors: ToolDef = {
  name: 'list_competitors',
  title: 'List competitors',
  description: "The competitors tracked for a project: brand name, domain, aliases scanned for, and whether tracking is on.",
  inputSchema: {
    type: 'object',
    properties: { project_id: projectIdSchema },
    required: ['project_id'],
    additionalProperties: false,
  },
  async handler(viewer, args) {
    const project = await readableProject(viewer, str(args, 'project_id', true)!)
    const competitors = await prisma.competitor.findMany({
      where: { projectId: project.id },
      orderBy: { brandName: 'asc' },
      select: { id: true, brandName: true, domain: true, aliases: true, active: true },
    })
    return {
      project: { id: project.id, name: project.name },
      competitors: competitors.map((c) => ({
        id: c.id,
        name: c.brandName,
        domain: c.domain,
        aliases: c.aliases.split(',').map((a) => a.trim()).filter(Boolean),
        tracking: c.active,
      })),
    }
  },
}

export const TOOLS: ToolDef[] = [
  listProjects,
  visibilitySummary,
  segmentBreakdown,
  trends,
  listPrompts,
  promptResults,
  topCitedDomains,
  visibilityGaps,
  listCompetitors,
]

export function toolList() {
  return TOOLS.map(({ name, title, description, inputSchema }) => ({
    name,
    title,
    description,
    inputSchema,
    annotations: { title, readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }))
}

export async function callTool(viewer: Viewer, name: string, args: Args) {
  const tool = TOOLS.find((t) => t.name === name)
  if (!tool) return null
  try {
    const data = await tool.handler(viewer, args ?? {})
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  } catch (err) {
    if (err instanceof ToolError) return { content: [{ type: 'text', text: err.message }], isError: true }
    console.error(`MCP tool ${name} failed:`, err)
    return { content: [{ type: 'text', text: 'The dashboard hit an internal error running this tool.' }], isError: true }
  }
}
