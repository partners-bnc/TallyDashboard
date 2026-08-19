import { describe, expect, it } from 'vitest'
import {
  groupAncestorIds,
  groupDescendantIds,
  isExcludedFromTdsSuggestion,
  isSuggestedTdsGroup,
  isSuggestedTdsLedger,
  normalizeTdsName,
  resolveLedgerGroupParents,
  tdsLedgerSuggestion,
} from '@/lib/tds-mapping'
import type { TdsMappingGroup } from '@/lib/types'

describe('TDS mapping suggestions', () => {
  it('normalizes punctuation and case', () => {
    expect(normalizeTdsName(' TDS-on  Contract (194 C) ')).toBe('tds on contract 194 c')
  })

  it('suggests TDS groups without matching unrelated tax groups', () => {
    expect(isSuggestedTdsGroup('Tds')).toBe(true)
    expect(isSuggestedTdsGroup('Tax Deducted at Source')).toBe(true)
    expect(isSuggestedTdsGroup('Duties & Taxes')).toBe(false)
  })

  it.each([
    'TDS Receivables',
    'TDS Recoverable',
    'Interest on Late TDS',
    'TDS LATE FILING FEES 234E',
  ])('keeps %s searchable but unchecked', (name) => {
    expect(isExcludedFromTdsSuggestion(name)).toBe(true)
    expect(isSuggestedTdsLedger(name)).toBe(false)
    expect(tdsLedgerSuggestion(name, true).selected).toBe(false)
  })

  it.each([
    'TDS on Contractor (194 C)',
    'TDS on Professional Fees 194 J',
    'TDS on Rent',
    'TDS on Salary',
    '194J',
  ])('auto-selects deduction ledger %s', (name) => {
    expect(isSuggestedTdsLedger(name)).toBe(true)
  })
})

describe('ledger group hierarchy', () => {
  const groups: TdsMappingGroup[] = [
    { groupId: 'duties', name: 'Duties & Taxes', parentName: 'Current Liabilities', parentGroupId: null, selected: false, suggested: false, directLedgerCount: 1 },
    { groupId: 'tds', name: 'Tds', parentName: 'Duties & Taxes', parentGroupId: null, selected: true, suggested: true, directLedgerCount: 4 },
    { groupId: 'gst', name: 'GST', parentName: 'Duties & Taxes', parentGroupId: null, selected: false, suggested: false, directLedgerCount: 2 },
  ]

  it('falls back to parent names when Tally group IDs are absent', () => {
    const resolved = resolveLedgerGroupParents(groups)
    expect(resolved.find((group) => group.groupId === 'tds')?.parentGroupId).toBe('duties')
    expect(resolved.find((group) => group.groupId === 'gst')?.parentGroupId).toBe('duties')
  })

  it('finds ancestors and descendants without selecting sibling branches', () => {
    const resolved = resolveLedgerGroupParents(groups)
    expect([...groupAncestorIds(resolved, 'tds')]).toEqual(['duties'])
    expect(groupDescendantIds(resolved, 'duties')).toEqual(new Set(['duties', 'tds', 'gst']))
    expect(groupDescendantIds(resolved, 'tds')).toEqual(new Set(['tds']))
  })
})
