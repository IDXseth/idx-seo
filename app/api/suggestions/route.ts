import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generatePromptSuggestions } from '@/lib/prompt-suggestions'

export const maxDuration = 60

// POST /api/suggestions — generate a preview list of nonbrand prompt
// suggestions, grounded in GSC query data and the user's competitor sites.
// Does not write anything to the database; see /api/suggestions/commit.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const {
    communityName = '',
    city = '',
    market = '',
    levelOfCare = '',
    categories = [],
    count = 20,
  } = body

  const result = await generatePromptSuggestions({
    userId: session.user.id,
    communityName: String(communityName).trim(),
    city: String(city).trim(),
    market: String(market).trim(),
    levelOfCare: String(levelOfCare).trim(),
    categories: Array.isArray(categories) ? categories.filter((c) => typeof c === 'string') : [],
    count: Number(count) || 20,
  })

  return NextResponse.json(result)
}
