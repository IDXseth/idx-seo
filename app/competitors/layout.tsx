import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function CompetitorsLayout({ children }: { children: React.ReactNode }) {
  try {
    const session = await auth()
    if (!session) redirect('/login?callbackUrl=/competitors')
  } catch {
    redirect('/login?callbackUrl=/competitors')
  }
  return <>{children}</>
}
