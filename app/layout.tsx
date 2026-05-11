import type { Metadata } from 'next'
import { Nunito, Noto_Serif } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'

const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' })
const notoSerif = Noto_Serif({ subsets: ['latin'], variable: '--font-noto-serif', weight: ['400', '700'] })

export const metadata: Metadata = {
  title: 'Senior Lifestyle AI Visibility Dashboard',
  description: 'Monitor AI mentions and citations for your senior living communities',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${nunito.variable} ${notoSerif.variable} font-sans min-h-full bg-[#f0f4f7]`}>
        <Nav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
