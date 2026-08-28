import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generatePromptSuggestions } from '@/lib/prompt-suggestions'

export const maxDuration = 60

// POST /api/suggestions — generate a preview list of nonbrand prompt
// suggestions, grounded in GSC query data and the user's competitor sites.
// Does not write anything to the database; see /api/suggestions/commit.
export async function POST(req: Request) {
  try {
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
  } catch (err) {
    // Belt-and-suspenders: generatePromptSuggestions already falls back to
    // templates on its own errors, so this only fires for something
    // upstream of it (e.g. auth/session lookup) — still worth a JSON
    // response instead of an unhandled crash.
    console.error('Suggestion generation error:', err)
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}
