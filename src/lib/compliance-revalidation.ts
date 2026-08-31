import 'server-only'

import { revalidatePath } from 'next/cache'

const reportPathByComplianceType: Record<string, `/dashboard/reports/${string}`> = {
  TDS: '/dashboard/reports/tds-report',
  PROMOTERS: '/dashboard/reports/promoters-report',
  GST: '/dashboard/reports/duties-and-taxes',
  ACCOUNTS_PAYABLE: '/dashboard/reports/accounts-payable',
  OPEX: '/dashboard/reports/operating-expenditure',
  CAPEX: '/dashboard/reports/capital-expenditure',
}

export function revalidateComplianceViews(complianceType: string) {
  revalidatePath('/dashboard/compliance-mapping')
  revalidatePath('/dashboard/overview')

  const reportPath = reportPathByComplianceType[complianceType]
  if (reportPath) revalidatePath(reportPath)
}
