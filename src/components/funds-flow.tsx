'use client'

import { useState, useTransition, useEffect, useMemo, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, ArrowsClockwise, CaretDown, Download, Scales, SpinnerGap, Table, X } from '@phosphor-icons/react'
import type { Company, FundsFlowData, FundsFlowGroupNode, Organization, FundsFlowEntry } from '@/lib/types'
import type { DetailedFundsFlowReportData } from '@/lib/data'
import Header from '@/components/ui/Header'
import Footer from '@/components/ui/Footer'
import { dashboardUrl } from '@/lib/dashboard-navigation'
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
    startTransition(() => router.replace(`/dashboard/funds-flow?${query({ org: orgId, company: companyId, from: String(formData.get('from') ?? ''), to: String(formData.get('to') ?? '') })}`))
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
  detailedData,
  from,
  to
}: {
  orgId: string
  companyId: string
  companyName: string
  orgName: string
  data: FundsFlowData | null
  detailedData: DetailedFundsFlowReportData | null
  from: string
  to: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<string>('summary')
  const [summaryMode, setSummaryMode] = useState<'groups' | 'subgroups'>('groups')
  const [selectedPath, setSelectedPath] = useState<string[]>([])
  const [selectedLedger, setSelectedLedger] = useState<string | null>(null)

  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null)
  const [voucherDetail, setVoucherDetail] = useState<any>(null)
  const [voucherError, setVoucherError] = useState('')

  const [showDetailedCompliance, setShowDetailedCompliance] = useState<boolean>(false)
  const [detailedActiveTab, setDetailedActiveTab] = useState<string>('report')
  const [detailedSubTabs, setDetailedSubTabs] = useState<Record<string, string>>({
    capex: 'A1',
    promoters: 'B1',
    tds: 'C1',
    opex: 'D1',
    ap: 'E1',
    gst: 'F1',
  })

  const REPORT_TABS = useMemo(() => {
    if (!detailedData) {
      return [
      { id: 'report', label: 'Report Sheet' },
        { id: 'capex', label: 'Capital Expenditure', refCodes: [] as string[] },
        { id: 'promoters', label: 'Promoters Report', refCodes: [] as string[] },
        { id: 'tds', label: 'TDS Compliance', refCodes: [] as string[] },
        { id: 'opex', label: 'Operating Expenditure', refCodes: [] as string[] },
        { id: 'ap', label: 'Accounts Payable', refCodes: [] as string[] },
        { id: 'gst', label: 'Duties & Taxes GST', refCodes: [] as string[] },
      ]
    }

    const getRefCodes = (title: string) => {
      const col = [...detailedData.leftColumn, ...detailedData.rightColumn].find(c => c.title === title)
      return col?.items.map(i => i.refCode) ?? []
    }

    return [
      { id: 'report', label: 'Report Sheet' },
      { id: 'capex', label: 'Capital Expenditure', refCodes: getRefCodes('Capital Expenditure') },
      { id: 'promoters', label: 'Promoters Report', refCodes: getRefCodes('Promoters Report') },
      { id: 'tds', label: 'TDS Compliance', refCodes: getRefCodes('TDS Compliance Report') },
      { id: 'opex', label: 'Operating Expenditure', refCodes: getRefCodes('Operating Expenditure') },
      { id: 'ap', label: 'Accounts Payable', refCodes: getRefCodes('Accounts Payable') },
      { id: 'gst', label: 'Duties & Taxes GST', refCodes: getRefCodes('Duties & Taxes GST') },
    ]
  }, [detailedData])

  const detailedAvailableRefs = useMemo(() => {
    if (!detailedData) return []
    const allItems = [
      ...detailedData.leftColumn.flatMap(c => c.items),
      ...detailedData.rightColumn.flatMap(c => c.items)
    ]
    return allItems.map(item => ({
      code: item.refCode,
      name: item.name.replace(/^-----/, '')
    }))
  }, [detailedData])

  useEffect(() => {
    setSelectedPath([])
    setSelectedLedger(null)
  }, [activeTab])

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
        // Skip groups that have zero balances/movements in the Summary sheet
        if (Math.abs(g.closingBalance) <= 0.005 && Math.abs(g.debitTotal) <= 0.005 && Math.abs(g.creditTotal) <= 0.005) {
          return
        }
        
        summaryRows.push([g.groupName.toUpperCase(), '', '', ''])
        
        const addSubgroups = (subgroups: FundsFlowGroupNode[], prefix = '  ') => {
          subgroups.forEach(sub => {
            summaryRows.push([
              `${prefix}${sub.name}`,
              sub.debitTotal || 0,
              sub.creditTotal || 0,
              sub.netMovement || 0
            ])
            if (sub.subgroups.length > 0) addSubgroups(sub.subgroups, prefix + '  ')
          })
        }
        addSubgroups(g.subgroups)

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

      const flattenGroup = (node: FundsFlowGroupNode) => {
        rows.push([`SUBGROUP: ${node.name.toUpperCase()}`])
        rows.push(['Date', 'Particulars', 'Nature / Group', 'Debit', 'Credit', 'Amount'])

        // Ledgers listing under Subgroup
        node.ledgers.forEach(led => {
          rows.push(['', `${led.ledgerName} (Closing Balance)`, '', '', '', led.closingBalance || 0])
        })

        // Vouchers listing under Subgroup
        node.voucherLines.forEach(l => {
          rows.push([
            l.date || '',
            l.particulars,
            l.nature || '',
            l.debit || 0,
            l.credit || 0,
            l.amount || 0
          ])
        })
        rows.push(['Subtotal Movement', '', '', node.debitTotal || 0, node.creditTotal || 0, node.netMovement || 0])
        rows.push([])

        node.subgroups.forEach(sub => flattenGroup(sub))
      }

      g.subgroups.forEach(sub => flattenGroup(sub))

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

  const exportDetailedToExcel = () => {
    if (!detailedData) return

    const wb = XLSX.utils.book_new()

    // ─── 1st Sheet: Report Sheet ───
    const leftRows: any[] = []
    detailedData.leftColumn.forEach((section) => {
      leftRows.push([section.title, 'Ref', 'Balance (INR)'])
      section.items
        .filter((item) => {
          return Math.abs(item.openingBalance) >= 0.01 || Math.abs(item.closingBalance) >= 0.01 || Math.abs(item.netMovement) >= 0.01
        })
        .forEach((item) => {
          leftRows.push([item.name.replace(/^-----/, '  '), item.refCode, item.closingBalance])
        })
      leftRows.push([`Total ${section.title}`, '', section.totalClosing])
      leftRows.push([])
    })

    const rightRows: any[] = []
    detailedData.rightColumn.forEach((section) => {
      rightRows.push([section.title, 'Ref', 'Balance (INR)'])
      section.items
        .filter((item) => {
          return Math.abs(item.openingBalance) >= 0.01 || Math.abs(item.closingBalance) >= 0.01 || Math.abs(item.netMovement) >= 0.01
        })
        .forEach((item) => {
          rightRows.push([item.name.replace(/^-----/, '  '), item.refCode, item.closingBalance])
        })
      rightRows.push([`Total ${section.title}`, '', section.totalClosing])
      rightRows.push([])
    })

    const maxRows = Math.max(leftRows.length, rightRows.length)
    const mergedRows: any[] = []
    mergedRows.push([`${companyName} - Detailed Compliance Statement`, '', '', '', `Period: Upto ${to || 'today'}`])
    mergedRows.push([])

    for (let r = 0; r < maxRows; r++) {
      const left = leftRows[r] || ['', '', '']
      const right = rightRows[r] || ['', '', '']
      mergedRows.push([
        left[0], left[1], left[2],
        '', // Spacing
        right[0], right[1], right[2]
      ])
    }

    const wsReport = XLSX.utils.aoa_to_sheet(mergedRows)
    wsReport['!cols'] = [
      { wch: 38 }, // Left Particulars
      { wch: 8 },  // Left Ref
      { wch: 18 }, // Left Balance
      { wch: 4 },  // Spacing
      { wch: 38 }, // Right Particulars
      { wch: 8 },  // Right Ref
      { wch: 18 }, // Right Balance
    ]

    // Style the Report sheet
    mergedRows.forEach((row, rowIndex) => {
      for (let colIndex = 0; colIndex < 7; colIndex++) {
        const colLetter = String.fromCharCode(65 + colIndex)
        const cellRef = `${colLetter}${rowIndex + 1}`
        const cell = wsReport[cellRef]
        if (!cell) continue

        cell.s = {
          font: { name: 'Segoe UI', sz: 10, color: { rgb: '333333' } },
          alignment: {
            horizontal: colIndex === 1 || colIndex === 5 ? 'center' : (colIndex === 2 || colIndex === 6 ? 'right' : 'left'),
            vertical: 'center'
          }
        }

        if (typeof cell.v === 'number') {
          cell.z = '₹#,##0.00'
        }

        if (rowIndex === 0) {
          cell.s.font = { name: 'Segoe UI', sz: 14, bold: true, color: { rgb: '14532D' } }
          continue
        }
        if (rowIndex === 1) continue

        const val = String(row[colIndex] || '')

        const isHeader = val === 'Capital Expenditure' || val === 'Promoters Report' || val === 'TDS Compliance Report' || val === 'Operating Expenditure' || val === 'Accounts Payable' || val === 'Duties & Taxes GST'
        if (isHeader) {
          cell.s.fill = { fgColor: { rgb: 'DCFCE7' } }
          cell.s.font = { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: '14532D' } }
          cell.s.border = {
            bottom: { style: 'medium', color: { rgb: '86EFAC' } }
          }
        }

        if (val.startsWith('Total ')) {
          cell.s.font = { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '1E3A8A' } }
          cell.s.border = {
            top: { style: 'thin', color: { rgb: 'CBD5E1' } },
            bottom: { style: 'double', color: { rgb: '1E3A8A' } }
          }
        }
      }
    })

    XLSX.utils.book_append_sheet(wb, wsReport, 'Report Sheet')

    // ─── 2nd+ Sheets: Reference Sheets ───
    const allItems = [
      ...detailedData.leftColumn.flatMap(c => c.items),
      ...detailedData.rightColumn.flatMap(c => c.items)
    ]

    allItems.forEach((item) => {
      const code = item.refCode
      const vouchers = detailedData.allVouchersByRefCode[code] ?? []
      if (vouchers.length === 0) return

      // Group vouchers by ledger name
      const grouped: Record<string, typeof vouchers> = {}
      vouchers.forEach((v) => {
        const name = v.ledgerName || 'Unassigned'
        if (!grouped[name]) grouped[name] = []
        grouped[name].push(v)
      })

      const refRows: any[] = []
      refRows.push([`${item.name.replace(/^-----/, '')} Details (Ref ${code})`])
      refRows.push([])

      const ledgerNames = Object.keys(grouped).sort()
      
      const ledgerHeadings: number[] = []
      const tableHeaders: number[] = []
      const totalRows: number[] = []

      ledgerNames.forEach((ledgerName) => {
        const ledgerVouchers = grouped[ledgerName]
        
        ledgerHeadings.push(refRows.length)
        refRows.push([ledgerName])

        tableHeaders.push(refRows.length)
        refRows.push(['Date', 'Particulars', 'Nature', 'Debit', 'Credit', 'Amount'])

        let totalDebit = 0
        let totalCredit = 0

        ledgerVouchers.forEach((v) => {
          totalDebit += v.debit
          totalCredit += v.credit
          refRows.push([
            v.date ? displayDate(v.date) : '',
            v.particulars,
            ledgerName,
            v.debit > 0 ? v.debit : '',
            v.credit > 0 ? v.credit : '',
            v.debit - v.credit
          ])
        })

        totalRows.push(refRows.length)
        refRows.push(['Total', '', '', totalDebit, totalCredit, totalDebit - totalCredit])
        refRows.push([])
      })

      const wsRef = XLSX.utils.aoa_to_sheet(refRows)
      wsRef['!cols'] = [
        { wch: 14 }, // Date
        { wch: 40 }, // Particulars
        { wch: 30 }, // Nature
        { wch: 18 }, // Debit
        { wch: 18 }, // Credit
        { wch: 18 }, // Amount
      ]

      refRows.forEach((row, rowIndex) => {
        const isHeading = ledgerHeadings.includes(rowIndex)
        const isHeader = tableHeaders.includes(rowIndex)
        const isTotal = totalRows.includes(rowIndex)

        for (let colIndex = 0; colIndex < 6; colIndex++) {
          const colLetter = String.fromCharCode(65 + colIndex)
          const cellRef = `${colLetter}${rowIndex + 1}`
          const cell = wsRef[cellRef]
          if (!cell) continue

          cell.s = {
            font: { name: 'Segoe UI', sz: 10, color: { rgb: '333333' } },
            alignment: {
              horizontal: colIndex === 0 ? 'center' : (colIndex >= 3 ? 'right' : 'left'),
              vertical: 'center'
            }
          }

          if (typeof cell.v === 'number') {
            cell.z = '₹#,##0.00'
          }

          if (rowIndex === 0) {
            cell.s.font = { name: 'Segoe UI', sz: 14, bold: true, color: { rgb: '1E293B' } }
            continue
          }

          if (isHeading) {
            cell.s.font = { name: 'Segoe UI', sz: 12, bold: true, color: { rgb: '0F172A' } }
            continue
          }

          if (isHeader) {
            cell.s.fill = { fgColor: { rgb: '1E293B' } }
            cell.s.font = { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: 'FFFFFF' } }
            cell.s.alignment.horizontal = colIndex >= 3 ? 'right' : 'left'
            continue
          }

          if (isTotal) {
            cell.s.font = { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '000000' } }
            cell.s.border = {
              top: { style: 'thin', color: { rgb: '64748B' } },
              bottom: { style: 'double', color: { rgb: '000000' } }
            }
          }
        }
      })

      const sheetName = code.substring(0, 31)
      XLSX.utils.book_append_sheet(wb, wsRef, sheetName)
    })

    const cleanToDate = (to || 'latest').replace(/[\/\\?%*:|"<>\s]/g, '_')
    const cleanCompanyName = companyName.replace(/[\/\\?%*:|"<>\s]/g, '_')
    const fileName = `${cleanCompanyName}_Detailed_Compliance_Report_${cleanToDate}.xlsx`

    XLSX.writeFile(wb, fileName)
  }

  if (showDetailedCompliance && detailedData) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between font-inter">
        <Header />
        <main className="flex-grow">
          <div className={styles.shell}>
            <header className={`${styles.header} mb-6 flex justify-between items-end`}>
              <div>
                <span className={styles.eyebrow}>Detailed Compliance Statement</span>
                <h1>Detailed Funds Flow Statement</h1>
                <p>{companyName} · {orgName} · Upto {to || 'today'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={styles.exportButton}
                  style={{ backgroundColor: '#1e293b', color: '#fff', borderColor: '#0f172a' }}
                  onClick={exportDetailedToExcel}
                  disabled={!detailedData}
                >
                  <Download size={16} /> Export Detailed Excel
                </button>
                <button
                  className={styles.exportButton}
                  onClick={() => setShowDetailedCompliance(false)}
                >
                  <ArrowLeft size={16} /> Back to Summary
                </button>
              </div>
            </header>
            
            {/* Sheet Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 mb-6 flex-wrap">
              {REPORT_TABS.map((tab) => {
                const isActive = detailedActiveTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setDetailedActiveTab(tab.id)}
                    className="flex items-center gap-1.5"
                    style={{
                      padding: '8px 16px',
                      background: isActive ? '#fff' : 'transparent',
                      border: isActive ? '1px solid #e2e8f0' : '1px solid transparent',
                      borderBottom: isActive ? '2.5px solid #16a34a' : '1.5px solid transparent',
                      borderRadius: '6px 6px 0 0',
                      fontSize: 13,
                      fontWeight: 700,
                      color: isActive ? '#16a34a' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    {tab.id === 'report' && <Table size={14} />}
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Sheet 1: Report Sheet (Excel side-by-side) */}
            {detailedActiveTab === 'report' && (
              <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '30px', minWidth: '960px' }}>
                  
                  {/* Left Column */}
                  <div className="flex flex-col gap-6">
                    {detailedData.leftColumn.map((section) => (
                      <div key={section.title} className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr style={{ background: '#dcfce7', borderBottom: '2.5px solid #86efac' }}>
                              <th className="p-2.5 text-left font-extrabold text-slate-800" style={{ fontSize: 13 }}>
                                {section.title}
                              </th>
                              <th className="p-2.5 text-center font-extrabold text-slate-800" style={{ width: 80 }}>
                                Ref
                              </th>
                              <th className="p-2.5 text-right font-extrabold text-slate-800" style={{ width: 140 }}>
                                Balance (INR)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.items
                              .filter((item) => {
                                return Math.abs(item.openingBalance) >= 0.01 || Math.abs(item.closingBalance) >= 0.01 || Math.abs(item.netMovement) >= 0.01
                              })
                              .map((item) => (
                                <tr key={item.key} className="border-b border-slate-200 hover:bg-slate-50">
                                  <td className="py-2 pr-2 pl-6 font-semibold text-slate-800">
                                    {item.name.replace(/^-----+/, '')}
                                  </td>
                                  <td className="p-2 text-center">
                                    {item.refCode === '-' ? (
                                      <span className="text-slate-400">—</span>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          const reportTab = REPORT_TABS.find(t => t.refCodes?.includes(item.refCode))
                                          if (reportTab) {
                                            setDetailedActiveTab(reportTab.id)
                                            setDetailedSubTabs(prev => ({ ...prev, [reportTab.id]: item.refCode }))
                                          }
                                        }}
                                        className="bg-blue-50 border border-blue-200 text-blue-700 font-bold rounded px-2 py-0.5 text-[10px] cursor-pointer hover:bg-blue-100 transition-colors"
                                      >
                                        {item.refCode}
                                      </button>
                                    )}
                                  </td>
                                <td className="p-2 text-right font-bold text-slate-900">
                                  {formatVal(item.closingBalance)}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-slate-50 border-t-2 border-slate-300 font-extrabold">
                              <td className="p-2.5">Total {section.title}</td>
                              <td></td>
                              <td className="p-2.5 text-right text-blue-800">
                                {formatVal(section.totalClosing)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>

                  {/* Right Column */}
                  <div className="flex flex-col gap-6">
                    {detailedData.rightColumn.map((section) => (
                      <div key={section.title} className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr style={{ background: '#dcfce7', borderBottom: '2.5px solid #86efac' }}>
                              <th className="p-2.5 text-left font-extrabold text-slate-800" style={{ fontSize: 13 }}>
                                {section.title}
                              </th>
                              <th className="p-2.5 text-center font-extrabold text-slate-800" style={{ width: 80 }}>
                                Ref
                              </th>
                              <th className="p-2.5 text-right font-extrabold text-slate-800" style={{ width: 140 }}>
                                Balance (INR)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.items
                              .filter((item) => {
                                return Math.abs(item.openingBalance) >= 0.01 || Math.abs(item.closingBalance) >= 0.01 || Math.abs(item.netMovement) >= 0.01
                              })
                              .map((item) => (
                                <tr key={item.key} className="border-b border-slate-200 hover:bg-slate-50">
                                  <td className="py-2 pr-2 pl-6 font-semibold text-slate-800">
                                    {item.name.replace(/^-----+/, '')}
                                  </td>
                                  <td className="p-2 text-center">
                                    {item.refCode === '-' ? (
                                      <span className="text-slate-400">—</span>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          const reportTab = REPORT_TABS.find(t => t.refCodes?.includes(item.refCode))
                                          if (reportTab) {
                                            setDetailedActiveTab(reportTab.id)
                                            setDetailedSubTabs(prev => ({ ...prev, [reportTab.id]: item.refCode }))
                                          }
                                        }}
                                        className="bg-blue-50 border border-blue-200 text-blue-700 font-bold rounded px-2 py-0.5 text-[10px] cursor-pointer hover:bg-blue-100 transition-colors"
                                      >
                                        {item.refCode}
                                      </button>
                                    )}
                                  </td>
                                <td className="p-2 text-right font-bold text-slate-900">
                                  {formatVal(item.closingBalance)}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-slate-50 border-t-2 border-slate-300 font-extrabold">
                              <td className="p-2.5">Total {section.title}</td>
                              <td></td>
                              <td className="p-2.5 text-right text-blue-800">
                                {formatVal(section.totalClosing)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            )}

            {/* Sheet 2: Reference Detail Sheet (Grouped by report page, sub-sheet by reference code) */}
            {detailedActiveTab !== 'report' && (() => {
              const currentReport = REPORT_TABS.find(t => t.id === detailedActiveTab)
              const availableCodes = currentReport?.refCodes ?? []

              // Filter codes that actually have mapped ledgers/vouchers or non-zero balance to avoid empty sub-sheets!
              const activeCodes = availableCodes.filter((code) => {
                const vouchers = detailedData.allVouchersByRefCode[code] ?? []
                if (vouchers.length > 0) return true

                const items = [...detailedData.leftColumn, ...detailedData.rightColumn].flatMap(s => s.items)
                const matchedItem = items.find(i => i.refCode === code)
                if (matchedItem && (Math.abs(matchedItem.openingBalance) >= 0.01 || Math.abs(matchedItem.closingBalance) >= 0.01)) return true

                return false
              })

              const activeSubTab = detailedSubTabs[detailedActiveTab] || activeCodes[0] || availableCodes[0]
              const activeRefObj = detailedAvailableRefs.find(r => r.code === activeSubTab)
              const activeRefName = activeRefObj ? activeRefObj.name : 'Unknown'
              const vouchers = detailedData.allVouchersByRefCode[activeSubTab] ?? []

              // Group vouchers by ledger name
              const groupedByLedger: Record<string, typeof vouchers> = {}
              vouchers.forEach((entry) => {
                const name = entry.ledgerName || 'Unassigned'
                if (!groupedByLedger[name]) {
                  groupedByLedger[name] = []
                }
                groupedByLedger[name].push(entry)
              })

              const ledgerNames = Object.keys(groupedByLedger).sort()

              return (
                <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col gap-8">
                  {/* Sub-tabs ribbon (like sub-sheets inside Excel) */}
                  <div className="flex items-center gap-2 mb-2 border-b border-slate-200 pb-2 flex-wrap">
                    <span className="text-xs font-extrabold text-slate-400 mr-2 uppercase tracking-wider">Sub-Sheets:</span>
                    {activeCodes.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">No active reference codes</span>
                    ) : (
                      activeCodes.map((code) => {
                        const isActive = activeSubTab === code
                        const refObj = detailedAvailableRefs.find(r => r.code === code)
                        return (
                          <button
                            key={code}
                            onClick={() => setDetailedSubTabs(prev => ({ ...prev, [detailedActiveTab]: code }))}
                            style={{
                              padding: '6px 14px',
                              background: isActive ? '#dcfce7' : 'transparent',
                              border: isActive ? '1px solid #86efac' : '1px solid transparent',
                              borderRadius: '6px',
                              fontSize: 12,
                              fontWeight: 700,
                              color: isActive ? '#14532d' : '#64748b',
                              cursor: 'pointer',
                            }}
                            title={refObj?.name}
                          >
                            {code}
                          </button>
                        )
                      })
                    )}
                  </div>

                  <div className="flex justify-between items-center mb-2 flex-wrap gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">
                        Reference Evidence: {activeSubTab} — {activeRefName}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Showing detailed Tally ledger voucher logs supporting Ref {activeSubTab} — {activeRefName}
                      </p>
                    </div>
                  </div>

                  {ledgerNames.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic border border-dashed rounded-lg">
                      No vouchers found for Reference Code {activeSubTab}.
                    </div>
                  ) : (
                    ledgerNames.map((ledgerName) => {
                      const ledgerVouchers = groupedByLedger[ledgerName]
                      const totalDebit = ledgerVouchers.reduce((sum, e) => sum + e.debit, 0)
                      const totalCredit = ledgerVouchers.reduce((sum, e) => sum + e.credit, 0)
                      const totalNet = totalDebit - totalCredit

                      return (
                        <div key={ledgerName} className="flex flex-col gap-3">
                          {/* Ledger Heading */}
                          <h4 className="text-sm font-bold text-slate-900 border-l-4 border-slate-700 pl-2 uppercase tracking-wide">
                            {ledgerName}
                          </h4>

                          {/* Dedicated Table */}
                          <div className="overflow-x-auto border border-slate-200 rounded-lg">
                            <table className="w-full border-collapse text-xs text-left">
                              <thead>
                                <tr className="bg-slate-800 border-b border-slate-900 text-slate-100 font-bold uppercase tracking-wider">
                                  <th className="p-3 w-32">Date</th>
                                  <th className="p-3">Particulars</th>
                                  <th className="p-3 w-48">Nature</th>
                                  <th className="p-3 text-right w-36">Debit (+)</th>
                                  <th className="p-3 text-right w-36">Credit (-)</th>
                                  <th className="p-3 text-right w-40">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ledgerVouchers.map((entry) => {
                                  const net = entry.debit - entry.credit
                                  return (
                                    <tr key={entry.id} className="border-b border-slate-200 hover:bg-slate-50">
                                      <td className="p-3 text-slate-500 font-semibold">{displayDate(entry.date)}</td>
                                      <td className="p-3">
                                        <div className="font-semibold text-slate-800">{entry.particulars}</div>
                                        {entry.number && (
                                          <div className="text-[10px] text-slate-400">{entry.type} #{entry.number}</div>
                                        )}
                                      </td>
                                      <td className="p-3 text-slate-600 font-medium">{ledgerName}</td>
                                      <td className="p-3 text-right font-medium text-slate-800">{entry.debit > 0 ? formatVal(entry.debit) : '—'}</td>
                                      <td className="p-3 text-right font-medium text-slate-800">{entry.credit > 0 ? formatVal(entry.credit) : '—'}</td>
                                      <td className={`p-3 text-right font-bold ${net >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                        {net >= 0 ? '+' : ''}{money.format(net)}
                                      </td>
                                    </tr>
                                  )
                                })}
                                {/* Ledger Total Row */}
                                <tr className="bg-slate-50 border-t-2 border-slate-300 font-extrabold text-slate-900">
                                  <td className="p-3" colSpan={3}>Total</td>
                                  <td className="p-3 text-right">{totalDebit > 0 ? money.format(totalDebit) : '—'}</td>
                                  <td className="p-3 text-right">{totalCredit > 0 ? money.format(totalCredit) : '—'}</td>
                                  <td className={`p-3 text-right ${totalNet >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                                    {totalNet >= 0 ? '+' : ''}{money.format(totalNet)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )
            })()}

          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between font-inter">
      <Header />
      <main className="flex-grow">
        <div className={styles.shell}>
          {/* Back button */}
          <button className={styles.backButton} type="button" onClick={() => router.back()}><ArrowLeft size={15} /> Back to Overview</button>

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
              <button
                className={styles.exportButton}
                style={{ backgroundColor: '#16a34a', color: '#fff', borderColor: '#15803d' }}
                onClick={() => setShowDetailedCompliance(true)}
              >
                📊 Detailed Report
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
                setSelectedLedger(null)
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'summary'
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
            {/* Cascading Subgroup Dropdowns */}
            {activeTab !== 'summary' && (() => {
              const activeGroup = data?.groups.find(g => g.groupName === activeTab)
              if (!activeGroup) return null

              const dropdowns: React.ReactNode[] = []

              // Level 1 Subgroups dropdown
              const level1Options = activeGroup.subgroups.map(s => s.name)
              const level1Selected = selectedPath[0] || 'all'

              dropdowns.push(
                <div key="level-1" className="flex items-center gap-2">
                  <div className="h-4 w-px bg-rule" />
                  <span className="text-xs text-muted font-semibold">Subgroup:</span>
                  <select
                    className="bg-paper border border-rule rounded-lg px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:border-accent cursor-pointer"
                    value={level1Selected}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === 'all') {
                        setSelectedPath([])
                      } else {
                        setSelectedPath([val])
                      }
                      setSelectedLedger(null)
                    }}
                  >
                    <option value="all">All Subgroups</option>
                    {level1Options.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              )

              // Cascade next levels
              let currentNode: FundsFlowGroupNode | undefined = undefined
              if (level1Selected !== 'all') {
                currentNode = activeGroup.subgroups.find(s => s.name === level1Selected)
              }

              let depth = 1
              while (currentNode && currentNode.subgroups.length > 0) {
                const currentDepth = depth
                const options = currentNode.subgroups.map(s => s.name)
                const selectedVal = selectedPath[currentDepth] || 'all'

                dropdowns.push(
                  <div key={`level-${currentDepth + 1}`} className="flex items-center gap-2">
                    <div className="h-4 w-px bg-rule" />
                    <span className="text-xs text-muted font-semibold">Subgroup:</span>
                    <select
                      className="bg-paper border border-rule rounded-lg px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:border-accent cursor-pointer"
                      value={selectedVal}
                      onChange={(e) => {
                        const val = e.target.value
                        const newPath = selectedPath.slice(0, currentDepth)
                        if (val !== 'all') {
                          newPath.push(val)
                        }
                        setSelectedPath(newPath)
                        setSelectedLedger(null)
                      }}
                    >
                      <option value="all">All Subgroups</option>
                      {options.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )

                if (selectedVal !== 'all') {
                  currentNode = currentNode.subgroups.find(s => s.name === selectedVal)
                  depth++
                } else {
                  break
                }
              }

              return dropdowns
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
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${summaryMode === 'groups'
                          ? 'bg-accent text-white shadow-sm'
                          : 'text-muted hover:text-foreground'
                          }`}
                      >
                        Groups Only
                      </button>
                      <button
                        onClick={() => setSummaryMode('subgroups')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${summaryMode === 'subgroups'
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
                      data.summary.groups
                        .filter(g => Math.abs(g.debitTotal) > 0.005 || Math.abs(g.creditTotal) > 0.005 || Math.abs(g.netMovement) > 0.005)
                        .map((g, idx) => (
                          <div
                            key={idx}
                            className={`${styles.rowUnified} ${styles.drillableRow}`}
                            onClick={() => {
                              setActiveTab(g.groupName)
                            }}
                          >
                            <span className={`${styles.particularLabel} flex items-center gap-2`}>
                              {g.groupName}
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md leading-none font-normal">
                                {(data.groups.find(x => x.groupName === g.groupName)?.subgroups ?? []).reduce((sum, sub) => sum + sub.ledgers.length + sub.subgroups.reduce((s2, sub2) => s2 + sub2.ledgers.length, 0), 0)} A/Cs
                              </span>
                            </span>
                            <span className="text-right text-red-600 font-medium">{formatVal(g.debitTotal)}</span>
                            <span className="text-right text-green-600 font-medium">{formatVal(g.creditTotal)}</span>
                            <span className={`text-right font-semibold ${g.netMovement >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {formatVal(g.netMovement)}
                            </span>
                          </div>
                        ))
                    ) : (
                      data.groups
                        .filter(g => Math.abs(g.debitTotal) > 0.005 || Math.abs(g.creditTotal) > 0.005 || Math.abs(g.netMovement) > 0.005)
                        .map((g, idx) => (
                          <div key={idx}>
                            {/* Primary Group Header Row */}
                            <div
                              className={`${styles.rowUnifiedPrimary} ${styles.drillableRow}`}
                              onClick={() => setActiveTab(g.groupName)}
                            >
                              <span className="font-bold text-foreground flex items-center gap-2">
                                {g.groupName}
                                <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md leading-none font-medium">
                                  {g.subgroups.reduce((sum, sub) => sum + sub.ledgers.length + sub.subgroups.reduce((s2, sub2) => s2 + sub2.ledgers.length, 0), 0)} A/Cs
                                </span>
                              </span>
                              <span className="text-right text-muted">—</span>
                              <span className="text-right text-muted">—</span>
                              <span className="text-right text-muted">—</span>
                            </div>

                            {/* Nested Subgroups */}
                            {(() => {
                              const renderSummarySubgroups = (subgroups: FundsFlowGroupNode[], depth = 0): React.ReactNode[] => {
                                return subgroups.flatMap((sub, sidx) => [
                                  <div key={sub.name + sidx} className={styles.rowUnifiedSubgroup}>
                                    <span className="text-muted font-medium flex items-center gap-2" style={{ paddingLeft: `${depth * 16 + 24}px` }}>
                                      {sub.name}
                                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md leading-none font-normal">
                                        {sub.ledgers.length + sub.subgroups.reduce((sum, s) => sum + s.ledgers.length, 0)} A/Cs
                                      </span>
                                    </span>
                                    <span className="text-right text-red-600 font-medium">{sub.debitTotal > 0 ? formatVal(sub.debitTotal) : '—'}</span>
                                    <span className="text-right text-green-600 font-medium">{sub.creditTotal > 0 ? formatVal(sub.creditTotal) : '—'}</span>
                                    <span className={`text-right font-medium ${sub.netMovement >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                      {formatVal(sub.netMovement)}
                                    </span>
                                  </div>,
                                  ...(sub.subgroups.length > 0 ? renderSummarySubgroups(sub.subgroups, depth + 1) : [])
                                ])
                              }
                              return renderSummarySubgroups(g.subgroups)
                            })()}

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

                  // Resolve targetNode recursively based on selectedPath
                  let targetNode: FundsFlowGroupNode | undefined = undefined
                  if (selectedPath.length > 0) {
                    let curr: FundsFlowGroupNode | undefined = activeGroup.subgroups.find(s => s.name === selectedPath[0])
                    for (let i = 1; i < selectedPath.length; i++) {
                      if (curr) {
                        curr = curr.subgroups.find(s => s.name === selectedPath[i])
                      }
                    }
                    targetNode = curr
                  }

                  const subgroupsToRender = targetNode ? [targetNode] : activeGroup.subgroups
                  const isFilteredView = selectedPath.length > 0

                  return (
                    <div className="flex flex-col gap-8">
                      {subgroupsToRender.map((sub, sidx) => {
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
                              <h4 className={`${styles.promoterTitle} flex items-center gap-2`} style={{ fontSize: '16px', margin: 0 }}>
                                {sub.name}
                                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-medium">
                                  {sub.ledgers.length} Accounts
                                </span>
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
                                            router.push(dashboardUrl('/dashboard/trial-balance/ledger', { orgId, companyId, to }, { ledger: l.ledgerId }))
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
                                      : `Subtotal Movement (${sub.name})`
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

                      {selectedPath.length === 0 && (
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
