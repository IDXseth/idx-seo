import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

// Excel sheet names: max 31 chars, no [ ] : * ? / \
function sanitizeSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Project'
  let candidate = base
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`
    candidate = base.slice(0, 31 - suffix.length) + suffix
    n++
  }
  used.add(candidate.toLowerCase())
  return candidate
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const userEmail = session.user.email

    const batches = await prisma.batch.findMany({
      where: {
        OR: [
          { userId },
          ...(userEmail ? [{ shares: { some: { email: userEmail } } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        prompts: { orderBy: { createdAt: 'asc' } },
      },
    })

    const workbook = XLSX.utils.book_new()
    const usedSheetNames = new Set<string>()

    for (const batch of batches) {
      const rows = batch.prompts.map((p) => ({
        'Prompt Type': p.promptType,
        'Category': p.category,
        'Community Name': p.communityName,
        'City': p.city,
        'Market': p.market,
        'Level of Care': p.levelOfCare,
        'Prompt Text': p.promptText,
        'Status': p.jobStatus,
        'Created At': p.createdAt.toISOString(),
      }))

      const sheet =
        rows.length > 0
          ? XLSX.utils.json_to_sheet(rows)
          : XLSX.utils.json_to_sheet([], {
              header: [
                'Prompt Type', 'Category', 'Community Name', 'City', 'Market',
                'Level of Care', 'Prompt Text', 'Status', 'Created At',
              ],
            })

      const sheetName = sanitizeSheetName(batch.name, usedSheetNames)
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
    }

    if (batches.length === 0) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['No projects found']]), 'Prompts')
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="prompts-export-${date}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Failed to export prompts' }, { status: 500 })
  }
}
