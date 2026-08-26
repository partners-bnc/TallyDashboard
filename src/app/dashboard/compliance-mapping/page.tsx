import { redirect } from 'next/navigation'
import { getCentralizedMappingData, type ComplianceMappingConfig } from '@/lib/centralized-mapping'
import { ReportMappingWizard } from '@/components/ui/ReportMappingWizard'

const TDS_CONFIG: ComplianceMappingConfig = {
  complianceType: 'TDS',
  title: 'TDS ledger mapping',
  description: 'Select the payable ledgers used by the TDS report.',
  autoSuggestGroup: (name: string) => {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    return /(^| )tds( |$)/.test(normalized) || normalized.includes('tax deducted at source')
  },
  defaultCategory: 'PAYABLE',
}

const PROMOTERS_CONFIG: ComplianceMappingConfig = {
  complianceType: 'PROMOTERS',
  title: 'Promoters ledger mapping',
  description: 'Identify the groups and ledgers representing promoters capital and unsecured loans.',
  autoSuggestGroup: (name: string) => {
    const normalized = name.toLowerCase()
    return normalized.includes('unsecured') || normalized.includes('promoter') || normalized.includes('capital')
  },
  defaultCategory: 'OTHER',
}

const GST_CONFIG: ComplianceMappingConfig = {
  complianceType: 'GST',
  title: 'GST ledger mapping',
  description: 'Identify the groups and ledgers representing GST input, output, and duties.',
  autoSuggestGroup: (name: string) => {
    const normalized = name.toLowerCase()
    return normalized.includes('gst') || normalized.includes('tax')
  },
  defaultCategory: 'OTHER',
}

const LOANS_CONFIG: ComplianceMappingConfig = {
  complianceType: 'LOANS',
  title: 'Loans ledger mapping',
  description: 'Identify the groups and ledgers representing secured and unsecured loans.',
  autoSuggestGroup: (name: string) => {
    const normalized = name.toLowerCase()
    return normalized.includes('loan') || normalized.includes('borrowing') || normalized.includes('secured')
  },
  defaultCategory: 'OTHER',
}

const OPEX_CONFIG: ComplianceMappingConfig = {
  complianceType: 'OPEX',
  title: 'Operating Expenditure ledger mapping',
  description: 'Identify the groups and ledgers representing Operating Expenses (OpEx) like rent, utilities, salaries, etc.',
  autoSuggestGroup: (name: string) => {
    const normalized = name.toLowerCase()
    return normalized.includes('expense') || normalized.includes('expenditure') || normalized.includes('indirect') || normalized.includes('administrative') || normalized.includes('operating')
  },
  defaultCategory: 'OTHER',
}

export default async function TdsComplianceMappingPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; company?: string; returnTo?: string; type?: string }>
}) {
  const params = await searchParams
  if (!params.org || !params.company) redirect('/dashboard')
  
const ACCOUNTS_PAYABLE_CONFIG: ComplianceMappingConfig = {
  complianceType: 'ACCOUNTS_PAYABLE',
  title: 'Accounts Payable ledger mapping',
  description: 'Identify the groups and ledgers representing supplier and vendor payables.',
  autoSuggestGroup: (name: string) => {
    const normalized = name.toLowerCase()
    return normalized.includes('payable') || normalized.includes('creditor') || normalized.includes('supplier') || normalized.includes('vendor')
  },
  defaultCategory: 'PAYABLE',
}

  const type = params.type || 'TDS'
  let config = TDS_CONFIG
  if (type === 'PROMOTERS') config = PROMOTERS_CONFIG
  else if (type === 'GST') config = GST_CONFIG
  else if (type === 'LOANS') config = LOANS_CONFIG
  else if (type === 'ACCOUNTS_PAYABLE') config = ACCOUNTS_PAYABLE_CONFIG
  else if (type === 'OPEX') config = OPEX_CONFIG

  const data = await getCentralizedMappingData(params.org, params.company, config)
  
  const returnTo = params.returnTo?.startsWith('/dashboard')
    && !params.returnTo.startsWith('/dashboard/compliance-mapping')
    ? params.returnTo
    : `/dashboard?org=${encodeURIComponent(params.org)}&company=${encodeURIComponent(params.company)}`
    
  return (
    <ReportMappingWizard
      initialData={data}
      complianceType={config.complianceType}
      title={config.title}
      description={config.description}
      defaultCategory={config.defaultCategory}
      returnTo={returnTo}
    />
  )
}
