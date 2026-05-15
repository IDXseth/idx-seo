import { PrismaClient } from '@prisma/client'
import { normalizeRow } from '../lib/normalize'

const prisma = new PrismaClient()

async function main() {
  const prompts = await prisma.prompt.findMany({
    select: {
      id: true,
      promptType: true,
      category: true,
      communityName: true,
      city: true,
      market: true,
      levelOfCare: true,
      promptText: true,
    },
  })

  console.log(`Found ${prompts.length} prompts. Normalizing…`)

  let updated = 0
  let skipped = 0
  const unknownCare: string[] = []

  for (const prompt of prompts) {
    const norm = normalizeRow({
      promptType: prompt.promptType,
      category: prompt.category,
      communityName: prompt.communityName,
      city: prompt.city,
      market: prompt.market,
      levelOfCare: prompt.levelOfCare,
      promptText: prompt.promptText,
    })

    if (norm.isUnknownCare && norm.levelOfCare) {
      unknownCare.push(`  [${prompt.id}] "${prompt.levelOfCare}" → kept as "${norm.levelOfCare}"`)
    }

    const changed =
      norm.promptType !== prompt.promptType ||
      norm.category !== prompt.category ||
      norm.communityName !== prompt.communityName ||
      norm.city !== prompt.city ||
      norm.market !== prompt.market ||
      norm.levelOfCare !== prompt.levelOfCare ||
      norm.promptText !== prompt.promptText

    if (!changed) {
      skipped++
      continue
    }

    await prisma.prompt.update({
      where: { id: prompt.id },
      data: {
        promptType: norm.promptType,
        category: norm.category,
        communityName: norm.communityName,
        city: norm.city,
        market: norm.market,
        levelOfCare: norm.levelOfCare,
        promptText: norm.promptText,
      },
    })
    updated++
  }

  console.log(`Done. Updated: ${updated}, Already clean: ${skipped}`)

  if (unknownCare.length > 0) {
    console.log(`\nWarning — ${unknownCare.length} prompt(s) had unrecognized Level of Care values (stored as title-cased):`)
    unknownCare.forEach((line) => console.log(line))
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
