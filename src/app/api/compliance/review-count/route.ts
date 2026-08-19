import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getTdsComplianceMappingData } from '@/lib/compliance-data'

const scopeSchema = z.object({ org: z.string().uuid(), company: z.string().uuid() })

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const parsed = scopeSchema.safeParse({ org: params.get('org'), company: params.get('company') })
  if (!parsed.success) return NextResponse.json({ error: 'A valid company scope is required.' }, { status: 400 })
  try {
    const data = await getTdsComplianceMappingData(parsed.data.org, parsed.data.company)
    return NextResponse.json({
      reviewRequiredCount: data.company.reviewRequiredCount,
    })
  } catch {
    return NextResponse.json({ error: 'Could not load compliance review status.' }, { status: 403 })
  }
}
