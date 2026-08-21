import { describe, expect, it } from 'vitest'
import {
  isExcludedFromTdsSuggestion,
  isInitiallySelectedTdsCandidate,
  isPayableTdsCandidate,
  isTdsGroupName,
  normalizeTdsName,
  resolveLedgerGroupParents,
  tdsHierarchyGroupIds,
} from '@/lib/tds-mapping'
import type { TdsMappingGroup } from '@/lib/types'

describe('TDS hierarchy discovery', () => {
  it('matches the standalone TDS term case-insensitively and the expanded name', () => {
    expect(isTdsGroupName('Tds')).toBe(true)
    expect(isTdsGroupName('Statutory TDS Payable')).toBe(true)
    expect(isTdsGroupName('Tax Deducted at Source')).toBe(true)
    expect(isTdsGroupName('Duties & Taxes')).toBe(false)
    expect(isTdsGroupName('TDSPayable')).toBe(false)
  })

  it('normalizes punctuation and case', () => {
    expect(normalizeTdsName(' TDS-on  Contract (194 C) ')).toBe('tds on contract 194 c')
  })

  it('finds a TDS subgroup and every nested subgroup without including siblings', () => {
    const groups: TdsMappingGroup[] = [
      { groupId: 'duties', name: 'Duties & Taxes', parentName: 'Current Liabilities', parentGroupId: null, directLedgerCount: 0, isTdsRoot: false },
      { groupId: 'tds', name: 'TDS', parentName: 'Duties & Taxes', parentGroupId: null, directLedgerCount: 1, isTdsRoot: true },
      { groupId: 'contractors', name: 'Contractor deductions', parentName: 'TDS', parentGroupId: null, directLedgerCount: 1, isTdsRoot: false },
      { groupId: 'lower', name: 'Lower deduction certificates', parentName: 'Contractor deductions', parentGroupId: null, directLedgerCount: 1, isTdsRoot: false },
      { groupId: 'gst', name: 'GST', parentName: 'Duties & Taxes', parentGroupId: null, directLedgerCount: 1, isTdsRoot: false },
    ]

    const resolved = resolveLedgerGroupParents(groups)
    expect(resolved.find((group) => group.groupId === 'tds')?.parentGroupId).toBe('duties')
    expect(tdsHierarchyGroupIds(resolved)).toEqual(new Set(['tds', 'contractors', 'lower']))
  })
})

describe('TDS payable candidates', () => {
  it.each([
    'TDS Receivable',
    'TDS Recoverable',
    'Interest on TDS',
    'TDS Penalty',
    'TDS Late Fee',
    'TDS Filing Fee',
    'TDS LATE FILING FEES 234E',
  ])('excludes %s', (name) => {
    expect(isExcludedFromTdsSuggestion(name)).toBe(true)
    expect(isPayableTdsCandidate(
      { ledgerName: name, parentGroupId: 'tds' },
      new Set(['tds']),
    )).toBe(false)
  })

  it('includes payable ledgers in nested TDS groups and rejects outside ledgers', () => {
    const scope = new Set(['tds', 'nested'])
    expect(isPayableTdsCandidate(
      { ledgerName: 'Contractor deduction', parentGroupId: 'nested' },
      scope,
    )).toBe(true)
    expect(isPayableTdsCandidate(
      { ledgerName: 'TDS AY 2024-25', parentGroupId: 'duties' },
      scope,
    )).toBe(false)
  })

  it('uses suggestions only before completion and saved rows after completion', () => {
    const saved = new Set(['saved-ledger'])
    expect(isInitiallySelectedTdsCandidate('new-ledger', false, saved)).toBe(true)
    expect(isInitiallySelectedTdsCandidate('saved-ledger', true, saved)).toBe(true)
    expect(isInitiallySelectedTdsCandidate('new-ledger', true, saved)).toBe(false)
  })
})
