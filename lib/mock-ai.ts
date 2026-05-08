import { PLATFORMS } from './utils'

// Seeded deterministic pseudo-random based on string seed
function seededRandom(seed: string): () => number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  // Simple LCG PRNG
  let state = Math.abs(hash) + 1
  return function() {
    state = (state * 1664525 + 1013904223) & 0xffffffff
    return (state >>> 0) / 0xffffffff
  }
}

function slugifyDomain(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/\s+/g, '')
}

const CITATION_DOMAINS = [
  'seniorly.com',
  'caring.com',
  'aplaceformom.com',
  'seniorliving.org',
  'medicare.gov',
  'yelp.com',
  'google.com',
]

const SENIOR_LIVING_PHRASES = [
  'offers a warm and welcoming environment',
  'provides personalized care plans',
  'features amenities including dining, activities, and wellness programs',
  'is known for its compassionate staff',
  'has received recognition for quality care',
  'offers a range of services tailored to individual needs',
  'provides 24/7 assistance and support',
  'focuses on resident dignity and independence',
]

const CARE_TYPE_PHRASES: Record<string, string> = {
  'Assisted Living': 'assisted living services with support for daily activities',
  'Independent Living': 'independent living options for active seniors',
  'Memory Care': 'specialized memory care for residents with dementia and Alzheimer\'s',
  'Skilled Nursing': 'skilled nursing care with licensed medical professionals on staff',
  'Short Term Care': 'short-term rehabilitation and recovery services',
  '': 'senior living services',
}

function generateResponseText(
  communityName: string,
  city: string,
  levelOfCare: string,
  promptType: string,
  platform: string,
  rand: () => number
): { text: string; isMentioned: boolean } {
  const mentionThreshold = promptType === 'brand' ? 0.4 : 0.15
  const shouldMention = rand() < mentionThreshold

  const careType = CARE_TYPE_PHRASES[levelOfCare] || CARE_TYPE_PHRASES['']
  const phrase1 = SENIOR_LIVING_PHRASES[Math.floor(rand() * SENIOR_LIVING_PHRASES.length)]
  const phrase2 = SENIOR_LIVING_PHRASES[Math.floor(rand() * SENIOR_LIVING_PHRASES.length)]

  let response = ''

  if (shouldMention) {
    response = `${communityName} in ${city} ${phrase1}. `
    response += `The community ${careType} and ${phrase2}. `
    response += `Families looking for senior living in ${city} often consider ${communityName} due to its reputation for quality care and resident satisfaction. `
    response += `The facility has been serving the ${city} area community for many years with a commitment to excellence. `
    response += `It is advisable to schedule a tour and speak with the staff to learn more about how ${communityName} can meet your specific needs.`
  } else {
    response = `When searching for senior living options in ${city}, there are several communities offering ${careType}. `
    response += `Many families in the area seek facilities that ${phrase1} and ${phrase2}. `
    response += `It is important to consider factors such as location, cost, care level, and community culture when making this important decision. `
    response += `Visiting multiple communities in person is strongly recommended to get a feel for the environment and staff. `
    response += `Local senior care advisors can also provide personalized guidance based on your family's specific needs and budget.`
  }

  return { text: response, isMentioned: shouldMention }
}

export interface MockResult {
  platform: string
  responseText: string
  isMentioned: boolean
  isCited: boolean
  citations: Array<{
    url: string
    title: string
    domain: string
  }>
}

export function generateMockResults(
  promptId: string,
  communityName: string,
  city: string,
  market: string,
  levelOfCare: string,
  promptType: string
): MockResult[] {
  return PLATFORMS.map((platform) => {
    const seed = `${promptId}-${platform}`
    const rand = seededRandom(seed)

    const { text, isMentioned } = generateResponseText(
      communityName,
      city,
      levelOfCare,
      promptType,
      platform,
      rand
    )

    const isCited = isMentioned && rand() < 0.6

    // Generate 2-6 citations
    const citationCount = 2 + Math.floor(rand() * 5)
    const communitySlug = slugifyDomain(communityName)
    const allDomains = [...CITATION_DOMAINS, `${communitySlug}.com`]

    const usedDomains = new Set<string>()
    const citations = []

    for (let i = 0; i < citationCount; i++) {
      let domain: string
      let attempts = 0
      do {
        domain = allDomains[Math.floor(rand() * allDomains.length)]
        attempts++
      } while (usedDomains.has(domain) && attempts < 20)

      usedDomains.add(domain)

      const pathSlug = city.toLowerCase().replace(/\s+/g, '-')
      const careSlug = levelOfCare.toLowerCase().replace(/\s+/g, '-') || 'senior-living'
      const url = `https://www.${domain}/${careSlug}/${pathSlug}`

      let title = ''
      if (domain === 'seniorly.com') {
        title = `Best Senior Living in ${city} | Seniorly`
      } else if (domain === 'caring.com') {
        title = `Senior Care in ${city}, ${market} | Caring.com`
      } else if (domain === 'aplaceformom.com') {
        title = `${levelOfCare || 'Senior Living'} near ${city} | A Place for Mom`
      } else if (domain === 'medicare.gov') {
        title = `Nursing Home Compare - ${city}, ${market}`
      } else if (domain === 'yelp.com') {
        title = `Best ${levelOfCare || 'Senior Living'} in ${city} - Yelp`
      } else if (domain === `${communitySlug}.com`) {
        title = `${communityName} - Official Website`
      } else {
        title = `Senior Living in ${city} | ${domain}`
      }

      citations.push({ url, title, domain })
    }

    return {
      platform,
      responseText: text,
      isMentioned,
      isCited,
      citations,
    }
  })
}
