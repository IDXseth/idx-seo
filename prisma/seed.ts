import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { generateMockResults } from '../lib/mock-ai'

const adapter = new PrismaPg({
  connectionString: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL']!,
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

const communities = [
  { name: 'Sunrise Senior Living', city: 'Phoenix', market: 'Phoenix Metro' },
  { name: 'Brookdale Gardens', city: 'Scottsdale', market: 'Phoenix Metro' },
  { name: 'Heritage Pines', city: 'Tempe', market: 'Phoenix Metro' },
  { name: 'Meadowbrook Place', city: 'Denver', market: 'Denver Metro' },
  { name: 'Summit Ridge Senior Living', city: 'Boulder', market: 'Denver Metro' },
  { name: 'Pinecrest Manor', city: 'Aurora', market: 'Denver Metro' },
  { name: 'Oceanview Estates', city: 'San Diego', market: 'San Diego Metro' },
  { name: 'Pacific Gardens Senior', city: 'La Jolla', market: 'San Diego Metro' },
]

const careLevels = [
  'Assisted Living',
  'Independent Living',
  'Memory Care',
  'Skilled Nursing',
  'Short Term Care',
]

const categories = [
  'Best Of',
  'Competitor Comparison',
  'General Discovery',
  'Care Specific',
  'Location Based',
]

const brandPromptTemplates = [
  'What can you tell me about {community} in {city}?',
  'Is {community} a good option for my parent in {city}?',
  'Tell me about the memory care program at {community}.',
  'How much does {community} cost in {city}?',
  'What are reviews saying about {community}?',
]

const nonbrandPromptTemplates = [
  'What are the best {care_level} communities in {city}?',
  'How do I choose a {care_level} facility in {city}?',
  'What should I look for in {care_level} in {city}?',
  'What is the average cost of {care_level} in {market}?',
  'What are the top-rated senior living options near {city}?',
]

function fillTemplate(template: string, community: typeof communities[0], careLevel: string): string {
  return template
    .replace('{community}', community.name)
    .replace('{city}', community.city)
    .replace('{market}', community.market)
    .replace('{care_level}', careLevel)
}

async function main() {
  console.log('Seeding database...')

  // Clear existing data
  await prisma.citation.deleteMany()
  await prisma.result.deleteMany()
  await prisma.prompt.deleteMany()
  await prisma.batch.deleteMany()

  // Create batch
  const batch = await prisma.batch.create({
    data: {
      name: 'Sample Data - Q1 2026',
      fileName: 'sample_prompts_q1_2026.xlsx',
    },
  })

  console.log(`Created batch: ${batch.id}`)

  const prompts = []

  // Create prompts for each community
  for (const community of communities) {
    const selectedCareLevels = careLevels.slice(0, 3) // Use first 3 care levels per community
    const category = categories[Math.floor(Math.random() * categories.length)]

    // Brand prompts
    for (const template of brandPromptTemplates.slice(0, 3)) {
      const careLevel = selectedCareLevels[Math.floor(Math.random() * selectedCareLevels.length)]
      const prompt = await prisma.prompt.create({
        data: {
          batchId: batch.id,
          promptType: 'brand',
          category,
          communityName: community.name,
          city: community.city,
          market: community.market,
          levelOfCare: careLevel,
          promptText: fillTemplate(template, community, careLevel),
        },
      })
      prompts.push(prompt)
    }

    // Non-brand prompts
    for (const template of nonbrandPromptTemplates.slice(0, 3)) {
      const careLevel = selectedCareLevels[Math.floor(Math.random() * selectedCareLevels.length)]
      const prompt = await prisma.prompt.create({
        data: {
          batchId: batch.id,
          promptType: 'nonbrand',
          category: categories[Math.floor(Math.random() * categories.length)],
          communityName: community.name,
          city: community.city,
          market: community.market,
          levelOfCare: careLevel,
          promptText: fillTemplate(template, community, careLevel),
        },
      })
      prompts.push(prompt)
    }
  }

  console.log(`Created ${prompts.length} prompts`)

  // Run mock results for all prompts
  let resultCount = 0
  let citationCount = 0

  for (const prompt of prompts) {
    const mockResults = generateMockResults(
      prompt.id,
      prompt.communityName,
      prompt.city,
      prompt.market,
      prompt.levelOfCare,
      prompt.promptType
    )

    for (const mock of mockResults) {
      const result = await prisma.result.create({
        data: {
          promptId: prompt.id,
          platform: mock.platform,
          responseText: mock.responseText,
          isMentioned: mock.isMentioned,
          isCited: mock.isCited,
        },
      })
      resultCount++

      if (mock.citations.length > 0) {
        await prisma.citation.createMany({
          data: mock.citations.map((c) => ({
            resultId: result.id,
            url: c.url,
            title: c.title,
            domain: c.domain,
          })),
        })
        citationCount += mock.citations.length
      }
    }
  }

  console.log(`Created ${resultCount} results and ${citationCount} citations`)
  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
