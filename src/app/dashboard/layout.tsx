import { Suspense, type ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { DataApiAuthenticationError, requireDataApiToken } from '@/lib/neon/data-api'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  try {
    await requireDataApiToken()
  } catch (error) {
    if (error instanceof DataApiAuthenticationError) redirect('/login?reason=session-expired')
    throw error
  }
  return <Suspense fallback={null}>{children}</Suspense>
}
