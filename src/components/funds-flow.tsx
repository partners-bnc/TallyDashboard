'use client'

import { useState, useTransition, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, ArrowsClockwise, CaretDown, Download, Scales, SpinnerGap, X } from '@phosphor-icons/react'
import type { Company, FundsFlowData, Organization, FundsFlowEntry } from '@/lib/types'
import Header from '@/components/ui/Header'
import Footer from '@/components/ui/Footer'
// @ts-ignore
import XLSX from 'xlsx-js-style'
import styles from './funds-flow.module.css'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const formatVal = (value: number) => value === 0 ? '—' : money.format(value)

const query = (values: Record<string, string | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value)
  return params.toString()
}

function PeriodForm({ orgId, companyId, from, to, isPending, startTransition }: { orgId: string; companyId: string; from: string; to: string; isPending: boolean; startTransition: any }) {
  const router = useRouter()
  const applyPeriod = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => router.push(`/dashboard/funds-flow?${query({ org: orgId, company: companyId, from: String(formData.get('from') ?? ''), to: String(formData.get('to') ?? '') })}`))
  }
  return (
    <form className={styles.periodForm} onSubmit={applyPeriod}>
      <label>From<input type="date" name="from" defaultValue={from} disabled={isPending} /></label>
      <label>To<input type="date" name="to" defaultValue={to} disabled={isPending} /></label>
      <button type="submit" disabled={isPending}>{isPending ? 'Applying…' : 'Apply'}</button>
    </form>
  )
}


function displayDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function FundsFlow({
  orgId,
  companyId,
  companyName,
  orgName,
  data,
  from,
  to
}: {
  orgId: string
  companyId: string
  companyName: string
  orgName: string
  data: FundsFlowData | null
  from: string
  to: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<string>('summary')
  const [summaryMode, setSummaryMode] = useState<'groups' | 'subgroups'>('groups')
  const [navigating, setNavigating] = useState(false)
  const [selectedSubgroup, setSelectedSubgroup] = useState<string>('all')
  const [selectedLedger, setSelectedLedger] = useState<string | null>(null)
  
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null)
  const [voucherDetail, setVoucherDetail] = useState<any>(null)
  const [voucherError, setVoucherError] = useState('')

  useEffect(() => {
    if (!selectedVoucherId) return

    const controller = new AbortController()
    setVoucherDetail(null)
    setVoucherError('')
    fetch(`/api/voucher?company=${companyId}&voucher=${selectedVoucherId}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error ?? 'Could not load voucher details')
        setVoucherDetail(payload)
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setVoucherError(reason instanceof Error ? reason.message : 'Could not load voucher details')
      })

    return () => controller.abort()
  }, [companyId, selectedVoucherId])

  useEffect(() => {
    if (!selectedVoucherId) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedVoucherId(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedVoucherId])

  // Client-side Excel Export using SheetJS
  const exportToExcel = () => {
    if (!data) return
    const wb = XLSX.utils.book_new()

    // 1. Summary Sheet Data
    const summaryRows: any[] = [
      [companyName],
      [`Management Report (Funds Movement Summary) upto ${to || 'today'}`],
      [],
      ['Tally Parent Group / Subgroup', 'Total Debits (Outflows)', 'Total Credits (Inflows)', 'Net Movement'],
    ]

    // If summaryMode is subgroups, export with nested subgroups!
    if (summaryMode === 'subgroups') {
      data.groups.forEach(g => {
        summaryRows.push([g.groupName.toUpperCase(), '', '', ''])
        g.subgroups.forEach(sub => {
          summaryRows.push([
            `  ${sub.subgroupName}`,
            sub.debitTotal || 0,
            sub.creditTotal || 0,
            sub.netMovement || 0
          ])
        })
        summaryRows.push([
          `${g.groupName} Total`,
          g.debitTotal || 0,
          g.creditTotal || 0,
          g.netMovement || 0
        ])
        summaryRows.push([])
      })
    } else {
      data.summary.groups.forEach(g => {
        summaryRows.push([
          g.groupName,
          g.debitTotal || 0,
          g.creditTotal || 0,
          g.netMovement || 0
        ])
      })
    }

    summaryRows.push([])
    summaryRows.push(['Grand Total', data.summary.totalDebits || 0, data.summary.totalCredits || 0, data.summary.netMovement || 0])

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
    
    // Auto-fit column widths for Summary
    wsSummary['!cols'] = [
      { wch: 38 }, // Group/Subgroup name
      { wch: 22 }, // Debits
      { wch: 22 }, // Credits
      { wch: 22 }  // Net Movement
    ]

    // Apply color-coding and backgrounds to Summary cells
    summaryRows.forEach((row, rowIndex) => {
      for (let colIndex = 0; colIndex < 4; colIndex++) {
        const colLetter = String.fromCharCode(65 + colIndex)
        const cellRef = `${colLetter}${rowIndex + 1}`
        const cell = wsSummary[cellRef]
        if (!cell) continue

        cell.s = {
          font: { name: 'Segoe UI', sz: 10, color: { rgb: '333333' } },
          alignment: { 
            horizontal: colIndex === 0 ? 'left' : 'right',
            vertical: 'center'
          }
        }

        if (typeof cell.v === 'number') {
          cell.z = '₹#,##0.00'
        }

        // Title styling
        if (rowIndex === 0) {
          cell.s.font = { name: 'Segoe UI', sz: 16, bold: true, color: { rgb: '1A365D' } }
          cell.s.alignment.horizontal = 'left'
          continue
        }
        if (rowIndex === 1) {
          cell.s.font = { name: 'Segoe UI', sz: 10, italic: true, color: { rgb: '555555' } }
          cell.s.alignment.horizontal = 'left'
          continue
        }
        if (rowIndex === 2) continue

        // Header Row styling (Row 4, index 3)
        if (rowIndex === 3) {
          cell.s.fill = { fgColor: { rgb: 'DCE6F1' } } // Soft bluish gray
          cell.s.font = { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '1A365D' } }
          cell.s.border = {
            top: { style: 'thin', color: { rgb: 'A0AEC0' } },
            bottom: { style: 'medium', color: { rgb: '1A365D' } }
          }
          continue
        }

        const firstColVal = String(row[0] || '')
        const isGrandTotal = (firstColVal === 'Grand Total')

        // Grand Total styling
        if (isGrandTotal) {
          cell.s.fill = { fgColor: { rgb: 'B9D3FC' } } // Accent blue background
          cell.s.font = { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: '1A365D' } }
          cell.s.border = {
            top: { style: 'thin', color: { rgb: '1A365D' } },
            bottom: { style: 'double', color: { rgb: '1A365D' } }
          }
          if (colIndex === 1 && typeof cell.v === 'number' && cell.v > 0) cell.s.font.color = { rgb: 'B91C1C' }
          if (colIndex === 2 && typeof cell.v === 'number' && cell.v > 0) cell.s.font.color = { rgb: '15803D' }
          if (colIndex === 3 && typeof cell.v === 'number') {
            cell.s.font.color = { rgb: cell.v >= 0 ? '15803D' : 'B91C1C' }
          }
          continue
        }

        // Parent Group / Subgroup Totals styling
        const isPrimaryGroupHeader = firstColVal === firstColVal.toUpperCase() && !firstColVal.includes('TOTAL') && firstColVal.trim().length > 0
        const isGroupTotal = firstColVal.includes('Total')

        if (isPrimaryGroupHeader) {
          cell.s.fill = { fgColor: { rgb: 'F1F5F9' } } // Slate-100
          cell.s.font = { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '475569' } }
          cell.s.border = {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }
          }
        } else if (isGroupTotal) {
          cell.s.fill = { fgColor: { rgb: 'F8FAFC' } } // Slate-50
          cell.s.font = { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '334155' } }
          cell.s.border = {
            top: { style: 'thin', color: { rgb: 'CBD5E1' } },
            bottom: { style: 'medium', color: { rgb: '94A3B8' } }
          }
          if (colIndex === 1 && typeof cell.v === 'number' && cell.v > 0) cell.s.font.color = { rgb: 'B91C1C' }
          if (colIndex === 2 && typeof cell.v === 'number' && cell.v > 0) cell.s.font.color = { rgb: '15803D' }
          if (colIndex === 3 && typeof cell.v === 'number') {
            cell.s.font.color = { rgb: cell.v >= 0 ? '15803D' : 'B91C1C' }
          }
        } else {
          // Subgroup details rows
          if (firstColVal.startsWith('  ')) {
            cell.s.font.italic = true
          }
          if (colIndex === 1 && typeof cell.v === 'number' && cell.v > 0) cell.s.font.color = { rgb: 'DC2626' } // Red debits
          if (colIndex === 2 && typeof cell.v === 'number' && cell.v > 0) cell.s.font.color = { rgb: '16A34A' } // Green credits
          if (colIndex === 3 && typeof cell.v === 'number') {
            cell.s.font.color = { rgb: cell.v >= 0 ? '16A34A' : 'DC2626' }
            cell.s.font.bold = true // Bold net movement
          }
        }
      }
    })
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Sheet')

    // 2. Dynamic Group Sheets
    data.groups.forEach((g, idx) => {
      const prefix = String.fromCharCode(65 + idx)
      const rows: any[] = [
        [`${g.groupName} Detailed Statement`],
        [`Company: ${companyName} | Upto ${to || 'today'}`],
        [],
      ]
      
      g.subgroups.forEach(sub => {
        rows.push([`SUBGROUP: ${sub.subgroupName.toUpperCase()}`])
        rows.push(['Date', 'Particulars', 'Nature / Group', 'Debit', 'Credit', 'Amount'])
        
        // Ledgers listing under Subgroup
        sub.ledgers.forEach(led => {
          rows.push(['', `${led.ledgerName} (Closing Balance)`, '', '', '', led.closingBalance || 0])
        })
        
        // Vouchers listing under Subgroup
        sub.voucherLines.forEach(l => {
          rows.push([
            l.date || '',
            l.particulars,
            l.nature || '',
            l.debit || 0,
            l.credit || 0,
            l.amount || 0
          ])
        })
        rows.push(['Subtotal Movement', '', '', sub.debitTotal || 0, sub.creditTotal || 0, sub.netMovement || 0])
        rows.push([])
      })
      
      rows.push(['Overall Total Movement', '', '', g.debitTotal || 0, g.creditTotal || 0, g.netMovement || 0])
      
      const wsGroup = XLSX.utils.aoa_to_sheet(rows)
      
      // Auto-fit column widths for Group sheet
      wsGroup['!cols'] = [
        { wch: 14 }, // Date
        { wch: 38 }, // Particulars
        { wch: 24 }, // Nature
        { wch: 18 }, // Debit
        { wch: 18 }, // Credit
        { wch: 18 }  // Amount/Balance
      ]

      // Format & Color Group Worksheet cells
      rows.forEach((row, rowIndex) => {
        for (let colIndex = 0; colIndex < 6; colIndex++) {
          const colLetter = String.fromCharCode(65 + colIndex)
          const cellRef = `${colLetter}${rowIndex + 1}`
          const cell = wsGroup[cellRef]
          if (!cell) continue

          cell.s = {
            font: { name: 'Segoe UI', sz: 10, color: { rgb: '333333' } },
            alignment: {
              horizontal: colIndex <= 2 ? 'left' : 'right',
              vertical: 'center'
            }
          }

          if (typeof cell.v === 'number') {
            cell.z = '₹#,##0.00'
          }

          if (rowIndex === 0) {
            cell.s.font = { name: 'Segoe UI', sz: 14, bold: true, color: { rgb: '1A365D' } }
            continue
          }
          if (rowIndex === 1) {
            cell.s.font = { name: 'Segoe UI', sz: 10, italic: true, color: { rgb: '555555' } }
            continue
          }
          if (rowIndex === 2) continue

          const firstColVal = String(row[0] || '')

          if (firstColVal.startsWith('SUBGROUP:')) {
            cell.s.fill = { fgColor: { rgb: 'E2E8F0' } } // Medium Slate
            cell.s.font = { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '1E293B' } }
            cell.s.border = {
              top: { style: 'thin', color: { rgb: '94A3B8' } },
              bottom: { style: 'thin', color: { rgb: '94A3B8' } }
            }
            continue
          }

          if (row[0] === 'Date' && row[3] === 'Debit') {
            cell.s.fill = { fgColor: { rgb: 'ECF2F9' } } // Soft bluish gray header
            cell.s.font = { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: '1A365D' } }
            cell.s.border = {
              bottom: { style: 'medium', color: { rgb: '1A365D' } }
            }
            continue
          }

          const isSubtotal = firstColVal === 'Subtotal Movement'
          const isOverallTotal = firstColVal === 'Overall Total Movement'

          if (isSubtotal) {
            cell.s.fill = { fgColor: { rgb: 'F8FAFC' } }
            cell.s.font = { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '475569' } }
            cell.s.border = {
              top: { style: 'thin', color: { rgb: 'CBD5E1' } },
              bottom: { style: 'thin', color: { rgb: 'CBD5E1' } }
            }
            if (colIndex === 3 && typeof cell.v === 'number' && cell.v > 0) cell.s.font.color = { rgb: 'B91C1C' }
            if (colIndex === 4 && typeof cell.v === 'number' && cell.v > 0) cell.s.font.color = { rgb: '15803D' }
            if (colIndex === 5 && typeof cell.v === 'number') {
              cell.s.font.color = { rgb: cell.v >= 0 ? '15803D' : 'B91C1C' }
            }
          } else if (isOverallTotal) {
            cell.s.fill = { fgColor: { rgb: 'CBD5E1' } } // Darker total header
            cell.s.font = { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: '1A365D' } }
            cell.s.border = {
              top: { style: 'medium', color: { rgb: '1A365D' } },
              bottom: { style: 'double', color: { rgb: '1A365D' } }
            }
            if (colIndex === 3 && typeof cell.v === 'number' && cell.v > 0) cell.s.font.color = { rgb: 'B91C1C' }
            if (colIndex === 4 && typeof cell.v === 'number' && cell.v > 0) cell.s.font.color = { rgb: '15803D' }
            if (colIndex === 5 && typeof cell.v === 'number') {
              cell.s.font.color = { rgb: cell.v >= 0 ? '15803D' : 'B91C1C' }
            }
          } else {
            // Ledger listing under Subgroup
            const isLedgerAccount = String(row[1] || '').includes('(Closing Balance)')
            if (isLedgerAccount) {
              cell.s.font.color = { rgb: '64748B' } // Gray out static closing balances
              cell.s.font.sz = 9
            } else {
              // Voucher transactions coloring
              if (colIndex === 3 && typeof cell.v === 'number' && cell.v > 0) cell.s.font.color = { rgb: 'DC2626' } // Red
              if (colIndex === 4 && typeof cell.v === 'number' && cell.v > 0) cell.s.font.color = { rgb: '16A34A' } // Green
              if (colIndex === 5 && typeof cell.v === 'number') {
                cell.s.font.color = { rgb: cell.v >= 0 ? '16A34A' : 'DC2626' }
              }
            }
          }
        }
      })

      const sheetName = `${prefix} (${g.groupName})`
        .replace(/[:\\/?*\[\]]/g, '_')
        .substring(0, 31)
      XLSX.utils.book_append_sheet(wb, wsGroup, sheetName)
    })

    // Slashes Bug Fix: Sanitize filename from directory separator slashes
    const cleanToDate = (to || 'latest').replace(/[\/\\?%*:|"<>\s]/g, '_')
    const cleanCompanyName = companyName.replace(/[\/\\?%*:|"<>\s]/g, '_')
    const fileName = `${cleanCompanyName}_Funds_Flow_${cleanToDate}.xlsx`
    
    XLSX.writeFile(wb, fileName)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between font-inter">
      <Header />
      <main className="flex-grow">
        <div className={styles.shell}>
          {/* Back button */}
          <button className={styles.backButton} disabled={navigating} onClick={() => { setNavigating(true); window.location.assign(`/dashboard/overview?${query({ org: orgId, company: companyId, to })}`) }}>
            {navigating ? <SpinnerGap className={styles.spin} size={15} /> : <ArrowLeft size={15} />} Back to Overview
          </button>

          {/* Page Header */}
          <header className={styles.header}>
            <div>
              <span className={styles.eyebrow}>Management Report</span>
              <h1>Funds Flow Statement</h1>
              <p>{companyName} · {orgName} · Upto {to || 'today'}</p>
            </div>
            
            <div className="flex items-end gap-2 flex-wrap">
              <button className={styles.exportButton} onClick={exportToExcel} disabled={!data}>
                <Download size={16} /> Export to Excel
              </button>
              <PeriodForm orgId={orgId} companyId={companyId} from={from} to={to} isPending={isPending} startTransition={startTransition} />
            </div>
          </header>

          {/* Sync warning states */}
          {data?.sync.error && <div className={styles.warning}>Sync error: {data.sync.error}</div>}
          {data?.history.message && <div className={styles.warning}>{data.history.message}</div>}

          {/* Redesigned Ribbon Tab Navigation */}
          <div className="flex items-center gap-3 mb-6 bg-paper p-2 rounded-xl border border-rule w-fit flex-wrap">
            <button
              onClick={() => {
                setActiveTab('summary')
                setSelectedSubgroup('all')
                setSelectedLedger(null)
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'summary'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-muted hover:text-foreground hover:bg-accent-soft'
              }`}
            >
              Summary Sheet
            </button>
            <div className="h-4 w-px bg-rule" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted font-semibold">Detailed Report:</span>
              <select
                className="bg-paper border border-rule rounded-lg px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:border-accent cursor-pointer"
                value={activeTab === 'summary' ? '' : activeTab}
                onChange={(e) => {
                  if (e.target.value) {
                    setActiveTab(e.target.value)
                    setSelectedSubgroup('all')
                    setSelectedLedger(null)
                  }
                }}
              >
                <option value="" disabled={activeTab !== 'summary'}>
                  Select Group Tab...
                </option>
                {data?.groups.map((g, idx) => {
                  const prefix = String.fromCharCode(65 + idx)
                  return (
                    <option key={g.groupName} value={g.groupName}>
                      {prefix} ({g.groupName})
                    </option>
                  )
                })}
              </select>
            </div>
            {/* Subgroup Dropdown */}
            {activeTab !== 'summary' && (() => {
              const activeGroup = data?.groups.find(g => g.groupName === activeTab)
              if (!activeGroup || activeGroup.subgroups.length <= 1) return null
              return (
                <>
                  <div className="h-4 w-px bg-rule" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted font-semibold">Subgroup:</span>
                    <select
                      className="bg-paper border border-rule rounded-lg px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:border-accent cursor-pointer"
                      value={selectedSubgroup}
                      onChange={(e) => {
                        setSelectedSubgroup(e.target.value)
                        setSelectedLedger(null)
                      }}
                    >
                      <option value="all">All Subgroups</option>
                      {activeGroup.subgroups.map(sub => (
                        <option key={sub.subgroupName} value={sub.subgroupName}>
                          {sub.subgroupName}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )
            })()}
          </div>

          {/* Tab Contents */}
          {!data ? (
            <div className={styles.state}>Could not load Funds Flow Statement. Please try again.</div>
          ) : !data.history.isAvailable ? (
            <div className={styles.state}>{data.history.message ?? 'History is not available for this date.'}</div>
          ) : (
            <section className={styles.reportContent}>
              
              {/* Summary Sheet Tab */}
              {activeTab === 'summary' && (
                <div className={styles.singleSummaryWrap}>
                  {/* Summary View Mode Switcher */}
                  <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                    <span className="text-sm font-semibold text-foreground">Summary View Mode:</span>
                    <div className="flex bg-accent-soft p-1 rounded-lg border border-rule">
                      <button
                        onClick={() => setSummaryMode('groups')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          summaryMode === 'groups'
                            ? 'bg-accent text-white shadow-sm'
                            : 'text-muted hover:text-foreground'
                        }`}
                      >
                        Groups Only
                      </button>
                      <button
                        onClick={() => setSummaryMode('subgroups')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          summaryMode === 'subgroups'
                            ? 'bg-accent text-white shadow-sm'
                            : 'text-muted hover:text-foreground'
                        }`}
                      >
                        With Subgroups
                      </button>
                    </div>
                  </div>

                  <div className={styles.tableWrap}>
                    <div className={styles.summaryGridHeader}>
                      <span>Tally Parent Group</span>
                      <span>Total Debits (Outflows)</span>
                      <span>Total Credits (Inflows)</span>
                      <span>Net Movement</span>
                    </div>
                    
                    {summaryMode === 'groups' ? (
                      data.summary.groups.map((g, idx) => (
                        <div 
                          key={idx} 
                          className={`${styles.rowUnified} ${styles.drillableRow}`}
                          onClick={() => {
                            setActiveTab(g.groupName)
                          }}
                        >
                          <span className={styles.particularLabel}>{g.groupName}</span>
                          <span className="text-right text-red-600 font-medium">{formatVal(g.debitTotal)}</span>
                          <span className="text-right text-green-600 font-medium">{formatVal(g.creditTotal)}</span>
                          <span className={`text-right font-semibold ${g.netMovement >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {formatVal(g.netMovement)}
                          </span>
                        </div>
                      ))
                    ) : (
                      data.groups.map((g, idx) => (
                        <div key={idx}>
                          {/* Primary Group Header Row */}
                          <div 
                            className={`${styles.rowUnifiedPrimary} ${styles.drillableRow}`}
                            onClick={() => setActiveTab(g.groupName)}
                          >
                            <span className="font-bold text-foreground">{g.groupName}</span>
                            <span className="text-right text-muted">—</span>
                            <span className="text-right text-muted">—</span>
                            <span className="text-right text-muted">—</span>
                          </div>
                          
                          {/* Nested Subgroups */}
                          {g.subgroups.map((sub, sidx) => (
                            <div key={sidx} className={styles.rowUnifiedSubgroup}>
                              <span className="pl-6 text-muted font-medium">{sub.subgroupName}</span>
                              <span className="text-right text-red-600 font-medium">{sub.debitTotal > 0 ? formatVal(sub.debitTotal) : '—'}</span>
                              <span className="text-right text-green-600 font-medium">{sub.creditTotal > 0 ? formatVal(sub.creditTotal) : '—'}</span>
                              <span className={`text-right font-medium ${sub.netMovement >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {formatVal(sub.netMovement)}
                              </span>
                            </div>
                          ))}
                          
                          {/* Group Total Row */}
                          <div className={styles.rowUnifiedTotal}>
                            <span className="font-semibold text-foreground">{g.groupName} Total</span>
                            <span className="text-right text-red-700 font-semibold">{g.debitTotal > 0 ? formatVal(g.debitTotal) : '—'}</span>
                            <span className="text-right text-green-700 font-semibold">{g.creditTotal > 0 ? formatVal(g.creditTotal) : '—'}</span>
                            <span className={`text-right font-bold ${g.netMovement >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                              {formatVal(g.netMovement)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                    
                    <div className={styles.totalRowUnified}>
                      <strong>Total Movement</strong>
                      <strong className="text-right text-red-700">{formatVal(data.summary.totalDebits)}</strong>
                      <strong className="text-right text-green-700">{formatVal(data.summary.totalCredits)}</strong>
                      <strong className={`text-right ${data.summary.netMovement >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                        {formatVal(data.summary.netMovement)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Group Vouchers Detail Sheets */}
              {activeTab !== 'summary' && (
                (() => {
                  const activeGroup = data.groups.find(g => g.groupName === activeTab)
                  if (!activeGroup) return <div className={styles.noDataRow}>No details found.</div>
                  
                  // Filter subgroups list if one specific subgroup is selected
                  const subgroupsToRender = selectedSubgroup === 'all' 
                    ? activeGroup.subgroups 
                    : activeGroup.subgroups.filter(sub => sub.subgroupName === selectedSubgroup)
                    
                  return (
                    <div className="flex flex-col gap-8">
                      {subgroupsToRender.map((sub, sidx) => {
                        // If selectedSubgroup is not 'all', we allow ledger selection/filtering within this subgroup
                        const isFilteredView = selectedSubgroup !== 'all'
                        
                        // Filter voucher lines for this subgroup if a specific ledger is selected
                        const displayVouchers = (isFilteredView && selectedLedger)
                          ? sub.voucherLines.filter(line => line.nature === selectedLedger)
                          : sub.voucherLines
                          
                        // Calculate display voucher totals
                        const displayDebitTotal = displayVouchers.reduce((sum, line) => sum + (line.debit || 0), 0)
                        const displayCreditTotal = displayVouchers.reduce((sum, line) => sum + (line.credit || 0), 0)
                        const displayNetMovement = displayCreditTotal - displayDebitTotal
                        
                        return (
                          <div key={sidx} className="flex flex-col gap-4 p-5 border border-slate-200 rounded-xl bg-white shadow-sm">
                            <div className="flex items-center justify-between border-b border-rule pb-2 flex-wrap gap-2">
                              <h4 className={styles.promoterTitle} style={{ fontSize: '16px', margin: 0 }}>
                                {sub.subgroupName}
                              </h4>
                              {isFilteredView && selectedLedger && (
                                <div className="flex items-center gap-2 bg-accent-soft px-3 py-1 rounded-lg">
                                  <span className="text-xs text-accent font-semibold">
                                    Filtered: {selectedLedger}
                                  </span>
                                  <button 
                                    className="p-0.5 rounded-full hover:bg-white text-accent transition-colors flex items-center justify-center"
                                    onClick={() => setSelectedLedger(null)}
                                    title="Clear ledger filter"
                                  >
                                    <X size={12} weight="bold" />
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            {/* Ledger Balances list in the subgroup */}
                            {sub.ledgers.length > 0 && (
                              <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                                  Ledger Accounts & Balances {isFilteredView && <span className="text-accent normal-case font-normal">(Click a ledger to filter vouchers, double-click to explore)</span>}
                                </span>
                                <div className={styles.tableWrap}>
                                  <div className={styles.detailGridHeader} style={{ gridTemplateColumns: 'minmax(200px, 1.5fr) 140px' }}>
                                    <span>Ledger Name</span>
                                    <span className="text-right">Closing Balance</span>
                                  </div>
                                  {sub.ledgers.map((l, lidx) => {
                                    const isSelected = selectedLedger === l.ledgerName
                                    return (
                                      <div 
                                        className={`${styles.detailRow} ${styles.clickableLedgerRow} ${isSelected ? styles.activeLedgerRow : ''}`}
                                        style={{ 
                                          gridTemplateColumns: 'minmax(200px, 1.5fr) 140px'
                                        }} 
                                        key={lidx}
                                        onClick={() => {
                                          if (isFilteredView) {
                                            setSelectedLedger(isSelected ? null : l.ledgerName)
                                          }
                                        }}
                                        onDoubleClick={() => {
                                          if (l.ledgerId) {
                                            window.location.assign(`/dashboard/trial-balance/ledger?${query({ org: orgId, company: companyId, ledger: l.ledgerId, to })}`)
                                          }
                                        }}
                                      >
                                        <span className="font-semibold">{l.ledgerName}</span>
                                        <span className="text-right font-medium">{formatVal(l.closingBalance)}</span>
                                      </div>
                                    )
                                  })}
                                  <div className={styles.totalRow} style={{ gridTemplateColumns: 'minmax(200px, 1.5fr) 140px' }}>
                                    <strong>Subgroup Balance Total</strong>
                                    <strong className="text-right">{formatVal(sub.closingBalance)}</strong>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Voucher Transactions list in the subgroup */}
                            <div className="flex flex-col gap-2" style={{ marginTop: '8px' }}>
                              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                                Voucher Transaction Logs {selectedLedger ? `(Showing ${selectedLedger} only)` : '(Period Movement)'}
                              </span>
                              <div className={styles.tableWrap}>
                                <div className={styles.detailGridHeader6}>
                                  <span>Date</span>
                                  <span>Particulars</span>
                                  <span>Nature / Group</span>
                                  <span>Debit</span>
                                  <span>Credit</span>
                                  <span>Net Amount</span>
                                </div>
                                {displayVouchers.map((line, idx) => (
                                  <div 
                                    className={`${styles.detailRow6} ${line.voucherId ? styles.clickableLedgerRow : ''}`} 
                                    key={idx}
                                    role={line.voucherId ? 'button' : undefined}
                                    onClick={() => line.voucherId && setSelectedVoucherId(line.voucherId)}
                                  >
                                    <span>{line.date ? new Date(line.date).toLocaleDateString('en-IN') : '—'}</span>
                                    <span className="font-semibold text-slate-800">{line.particulars}</span>
                                    <span className={styles.natureTag}>{line.nature || '—'}</span>
                                    <span className="text-right text-red-600">{line.debit ? formatVal(line.debit) : '—'}</span>
                                    <span className="text-right text-green-600">{line.credit ? formatVal(line.credit) : '—'}</span>
                                    <span className="text-right font-medium">{formatVal(line.amount ?? 0)}</span>
                                  </div>
                                ))}
                                {displayVouchers.length === 0 && (
                                  <div className={styles.noDataRow}>No transaction logs found for this period.</div>
                                )}
                                <div className={styles.totalRow6}>
                                  <strong>
                                    {selectedLedger 
                                      ? `Total Movement (${selectedLedger})` 
                                      : `Subtotal Movement (${sub.subgroupName})`
                                    }
                                  </strong>
                                  <span></span>
                                  <span></span>
                                  <strong className="text-right text-red-700">{formatVal(displayDebitTotal)}</strong>
                                  <strong className="text-right text-green-700">{formatVal(displayCreditTotal)}</strong>
                                  <strong className={`text-right ${displayNetMovement >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                                    {formatVal(displayNetMovement)}
                                  </strong>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      
                      {selectedSubgroup === 'all' && (
                        <div className={styles.tableWrap} style={{ marginTop: '12px' }}>
                          <div className={styles.totalRow6} style={{ borderTop: 'none', background: 'var(--accent-soft)' }}>
                            <strong>Overall Total ({activeGroup.groupName})</strong>
                            <span></span>
                            <span></span>
                            <strong className="text-right text-red-700">{formatVal(activeGroup.debitTotal)}</strong>
                            <strong className="text-right text-green-700">{formatVal(activeGroup.creditTotal)}</strong>
                            <strong className={`text-right ${activeGroup.netMovement >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                              {formatVal(activeGroup.netMovement)}
                            </strong>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()
              )}

            </section>
          )}

        </div>
      </main>

      {selectedVoucherId && (
        <div className={styles.drawerBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedVoucherId(null) }}>
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="voucher-detail-title">
            <div className={styles.drawerHeader}>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accounting Voucher</span>
                <h2 id="voucher-detail-title">
                  {voucherDetail?.voucher.voucher_type ?? 'Voucher'}
                  {voucherDetail?.voucher.voucher_number ? ` No. ${voucherDetail.voucher.voucher_number}` : ''}
                </h2>
                <span>{voucherDetail?.voucher.voucher_date ? displayDate(voucherDetail.voucher.voucher_date) : 'Loading voucher…'}</span>
              </div>
              <button type="button" aria-label="Close voucher details" onClick={() => setSelectedVoucherId(null)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center">
                <X size={20} />
              </button>
            </div>

            {!voucherDetail && !voucherError ? (
              <div className={styles.drawerNotice}><SpinnerGap size={20} className="animate-spin mx-auto mb-2" />Loading voucher details…</div>
            ) : voucherError ? (
              <div className={styles.drawerNotice}>{voucherError}</div>
            ) : voucherDetail ? (
              <>
                <div className={styles.drawerStats}>
                  <div className={styles.metric}>
                    <span>{voucherDetail.voucher.voucher_type?.toLowerCase() === 'purchase' ? 'Supplier Invoice No.' : 'Reference'}</span>
                    <strong>{voucherDetail.voucher.reference || '—'}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Party A/c Name</span>
                    <strong>{voucherDetail.voucher.party_ledger_name || '—'}</strong>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Particulars</span>
                    <span>Amount</span>
                  </div>
                  <div className={styles.drawerLines}>
                    {voucherDetail.entries.length ? voucherDetail.entries.map((entry: any) => (
                      <div key={entry.id} className={styles.drawerLine}>
                        <div><strong>{entry.ledger_name}</strong></div>
                        <div><strong>{money.format(entry.display_amount)}</strong></div>
                      </div>
                    )) : <div className={styles.drawerNotice}>No ledger entries found.</div>}
                  </div>
                </div>
                <div className={styles.drawerFooter}>
                  <span>Total</span>
                  <strong>{money.format(voucherDetail.totalAmount)}</strong>
                </div>
                {voucherDetail.voucher.narration && (
                  <div className="border-t border-slate-200 pt-4">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Narration</span>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{voucherDetail.voucher.narration}</p>
                  </div>
                )}
              </>
            ) : null}
          </aside>
        </div>
      )}

      <Footer />
    </div>
  )
}
