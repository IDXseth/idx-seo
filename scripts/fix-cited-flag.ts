import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, statement_timeout: 30000 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const toFix = await prisma.result.findMany({
    where: {
      isCited: false,
      citations: {
        some: {
          OR: [
            { url: { contains: 'seniorlifestyle.com', mode: 'insensitive' } },
            { domain: { contains: 'seniorlifestyle.com', mode: 'insensitive' } },
          ],
        },
      },
    },
    select: { id: true },
  })

  console.log(`Found ${toFix.length} results where isCited=false but seniorlifestyle.com citation exists.`)

  if (toFix.length === 0) {
    console.log('Nothing to update.')
    return
  }

  const { count } = await prisma.result.updateMany({
    where: { id: { in: toFix.map((r) => r.id) } },
    data: { isCited: true },
  })

  console.log(`Updated ${count} results to isCited=true.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => pool.end())
