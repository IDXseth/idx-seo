import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export const PLATFORMS = [
  'chatgpt',
  'claude',
  'perplexity',
  'gemini',
  'google_aio',
  'google_ai_mode',
] as const

export type Platform = typeof PLATFORMS[number]

export const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  google_aio: 'Google AI Overviews',
  google_ai_mode: 'AI Mode',
}

export const PLATFORM_COLORS: Record<string, string> = {
  chatgpt: '#10A37F',
  claude: '#D97706',
  perplexity: '#6366F1',
  gemini: '#3B82F6',
  google_aio: '#EF4444',
  google_ai_mode: '#8B5CF6',
}

export function getMentionColor(rate: number): string {
  if (rate >= 0.6) return 'text-green-600'
  if (rate >= 0.3) return 'text-yellow-600'
  return 'text-red-600'
}

export function getMentionBgColor(rate: number): string {
  if (rate >= 0.6) return 'bg-green-100 text-green-800'
  if (rate >= 0.3) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}
