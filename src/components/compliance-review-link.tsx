'use client'

import { useEffect, useState } from 'react'
import NextLink from 'next/link'
import { Badge } from '@astryxdesign/core/Badge'
import { Link } from '@astryxdesign/core/Link'
import { HStack } from '@astryxdesign/core/Stack'

export function ComplianceReviewLink({ orgId, companyId }: { orgId: string | null; companyId: string | null }) {
  const [reviewRequiredCount, setReviewRequiredCount] = useState(0)

  useEffect(() => {
    if (!orgId || !companyId) return
    const controller = new AbortController()
    fetch(`/api/compliance/review-count?org=${encodeURIComponent(orgId)}&company=${encodeURIComponent(companyId)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => setReviewRequiredCount(result?.reviewRequiredCount ?? 0))
      .catch(() => undefined)
    return () => controller.abort()
  }, [companyId, orgId])

  if (!orgId || !companyId) return null
  return (
    <HStack gap={1.5} vAlign="center">
      <Link as={NextLink} href={`/dashboard/compliance-mapping?org=${encodeURIComponent(orgId)}&company=${encodeURIComponent(companyId)}`} isStandalone>
        Report mapping
      </Link>
      {reviewRequiredCount > 0 && <Badge variant="warning" label={reviewRequiredCount} />}
    </HStack>
  )
}
