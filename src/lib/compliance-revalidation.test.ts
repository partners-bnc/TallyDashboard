import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.hoisted(() => vi.fn())

vi.mock('next/cache', () => ({ revalidatePath }))

import { revalidateComplianceViews } from './compliance-revalidation'

describe('revalidateComplianceViews', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invalidates the dashboard and TDS report after a TDS mapping changes', () => {
    revalidateComplianceViews('TDS')

    expect(revalidatePath.mock.calls).toEqual([
      ['/dashboard/compliance-mapping'],
      ['/dashboard/overview'],
      ['/dashboard/reports/tds-report'],
    ])
  })

  it('invalidates the report matching the saved compliance type', () => {
    revalidateComplianceViews('GST')

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/reports/duties-and-taxes')
    expect(revalidatePath).not.toHaveBeenCalledWith('/dashboard/reports/tds-report')
  })
})
