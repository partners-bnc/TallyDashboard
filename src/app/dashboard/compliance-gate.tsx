'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { tdsMappingStorageKey } from '@/lib/tds-mapping'

export function ComplianceGate({ userId, children }: { userId: string; children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [approvedScope, setApprovedScope] = useState<string | null>(null)
  const orgId = searchParams.get('org')
  const companyId = searchParams.get('company')
  const isExempt = pathname === '/dashboard/compliance-mapping' || !orgId || !companyId

  useEffect(() => {
    if (isExempt || !orgId || !companyId) return
    const scope = `${orgId}:${companyId}`
    if (localStorage.getItem(tdsMappingStorageKey(userId, orgId, companyId)) === 'complete') {
      queueMicrotask(() => setApprovedScope(scope))
      return undefined
    }
    const query = searchParams.toString()
    const returnTo = `${pathname}${query ? `?${query}` : ''}`
    router.replace(`/dashboard/compliance-mapping?org=${encodeURIComponent(orgId)}&company=${encodeURIComponent(companyId)}&returnTo=${encodeURIComponent(returnTo)}`)
  }, [companyId, isExempt, orgId, pathname, router, searchParams, userId])

  return isExempt || approvedScope === `${orgId}:${companyId}` ? children : null
}
