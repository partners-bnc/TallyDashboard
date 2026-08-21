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
    const controller = new AbortController()
    const scope = `${orgId}:${companyId}`
    const storageKey = tdsMappingStorageKey(userId, orgId, companyId)
    fetch(`/api/compliance/review-count?org=${encodeURIComponent(orgId)}&company=${encodeURIComponent(companyId)}`, {
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => {
        if (controller.signal.aborted) return
        if (result?.reviewRequiredCount === 0) {
          localStorage.setItem(storageKey, 'complete')
          queueMicrotask(() => setApprovedScope(scope))
          return
        }
        localStorage.removeItem(storageKey)
        const query = searchParams.toString()
        const returnTo = `${pathname}${query ? `?${query}` : ''}`
        router.replace(`/dashboard/compliance-mapping?org=${encodeURIComponent(orgId)}&company=${encodeURIComponent(companyId)}&returnTo=${encodeURIComponent(returnTo)}`)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [companyId, isExempt, orgId, pathname, router, searchParams, userId])

  return isExempt || approvedScope === `${orgId}:${companyId}` ? children : null
}
