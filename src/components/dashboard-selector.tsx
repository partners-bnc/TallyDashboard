'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Building2, Landmark, Loader2 } from 'lucide-react'
import type { Company, Organization } from '@/lib/types'
import Header from '@/components/ui/Header'
import Footer from '@/components/ui/Footer'

interface DashboardSelectorProps {
  organizations: Organization[]
  companies: Company[]
  selectedOrganizationId: string | null
  selectedCompanyId: string | null
}

export function DashboardSelector({
  organizations,
  companies,
  selectedOrganizationId,
  selectedCompanyId,
}: DashboardSelectorProps) {
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  const handleOrgChange = (orgId: string) => {
    setIsTransitioning(true)
    const params = new URLSearchParams()
    if (orgId) {
      params.set('org', orgId)
    }
    window.location.assign(`/dashboard?${params.toString()}`)
  }

  const handleCompanyChange = (companyId: string) => {
    setIsTransitioning(true)
    const params = new URLSearchParams()
    if (selectedOrganizationId) {
      params.set('org', selectedOrganizationId)
    }
    if (companyId) {
      params.set('company', companyId)
    }
    window.location.assign(`/dashboard?${params.toString()}`)
  }

  const dashboardUrl = selectedOrganizationId && selectedCompanyId
    ? `/dashboard/overview?org=${selectedOrganizationId}&company=${selectedCompanyId}`
    : '#'

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between font-inter">
      <Header />
      
      <main className="flex-grow flex items-center justify-center py-20 px-4">
        {/* Double-Bezel Outer Container */}
        <div className="w-full max-w-md p-1.5 rounded-[2rem] bg-black/[0.02] border border-black/[0.04]">
          {/* Inner Content Core */}
          <div className="bg-white rounded-[calc(2rem-0.375rem)] shadow-lg border border-slate-100 p-8 flex flex-col items-center">
            
            {/* Header Icon Block */}
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 border border-blue-100/50">
              <Landmark className="w-5 h-5 text-primary" />
            </div>

            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight text-center mb-2">
              Select Workspace
            </h1>
            <p className="text-sm text-slate-500 text-center mb-8 max-w-[280px]">
              Choose an organization and company to load your Tally financial dashboard.
            </p>

            <div className="w-full flex flex-col gap-5">
              {/* Organization Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Organization
                </label>
                <div className="relative">
                  <select
                    value={selectedOrganizationId ?? ''}
                    disabled={isTransitioning}
                    onChange={(e) => handleOrgChange(e.target.value)}
                    className="w-full h-11 pl-4 pr-10 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 text-sm font-medium appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Building2 size={16} />
                  </div>
                </div>
              </div>

              {/* Company Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Company
                </label>
                <div className="relative">
                  <select
                    value={selectedCompanyId ?? ''}
                    disabled={!selectedOrganizationId || isTransitioning}
                    onChange={(e) => handleCompanyChange(e.target.value)}
                    className="w-full h-11 pl-4 pr-10 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 text-sm font-medium appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {selectedOrganizationId ? 'Select company' : 'Select organization first'}
                    </option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Building2 size={16} />
                  </div>
                </div>
              </div>

              {/* Navigation Action */}
              <Link
                href={dashboardUrl}
                aria-disabled={!selectedCompanyId || isTransitioning}
                tabIndex={!selectedCompanyId || isTransitioning ? -1 : undefined}
                onClick={() => setIsTransitioning(true)}
                className={`w-full h-11 bg-primary hover:bg-primary/95 text-white font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm mt-4 font-inter ${
                  !selectedCompanyId || isTransitioning ? 'opacity-50 cursor-not-allowed pointer-events-none shadow-none hover:shadow-none' : ''
                }`}
              >
                {isTransitioning ? (
                  <>
                    Loading Workspace...
                    <Loader2 size={16} className="animate-spin" />
                  </>
                ) : (
                  <>
                    Enter Workspace
                    <ArrowRight size={16} />
                  </>
                )}
              </Link>

              {isTransitioning && (
                <div className="flex items-center justify-center gap-2 text-slate-400 mt-1">
                  <Loader2 size={13} className="animate-spin" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Connecting to books...
                  </span>
                </div>
              )}
            </div>
            
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  )
}
