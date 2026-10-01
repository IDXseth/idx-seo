import type { Metadata } from 'next'
import { Nunito, Noto_Serif } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { SessionProviderWrapper } from '@/components/session-provider'
import { APP_TITLE, APP_DESCRIPTION, APP_THEME } from '@/lib/app-config'

const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' })
const notoSerif = Noto_Serif({ subsets: ['latin'], variable: '--font-noto-serif', weight: ['400', '700'] })

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_DESCRIPTION,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" data-theme={APP_THEME || undefined}>
      <body className={`${nunito.variable} ${notoSerif.variable} font-sans min-h-full bg-(--c-page)`}>
        <SessionProviderWrapper>
          <Nav />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
