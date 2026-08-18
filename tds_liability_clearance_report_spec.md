# TDS Deposit and Liability Clearance Report

## 1. Objective

Build a company-wise TDS report that answers, for every TDS ledger and every deduction month:

1. How much TDS liability was created?
2. What was its statutory deposit due date?
3. How much was deposited?
4. On which date was it deposited?
5. Which outstanding liability was knocked off by the deposit?
6. How much remains unpaid?
7. Was the liability cleared on time, cleared late, partially cleared, or left unpaid?

This is primarily a **books-based TDS liability clearance report**. Unless challan details are independently captured and verified, it must not claim that a government challan has been verified.

---

## 2. Report Scope

The report must work for:

- Every active company in `tb_companies`
- Every ledger identified as a TDS payable ledger
- Every month in the selected financial/tax year
- Purchase, Journal, Payment, reversal and adjustment vouchers
- Opening outstanding TDS brought forward from earlier periods
- Full, partial, late and excess payments

Keep each company and each TDS ledger separate. A payment against Contractor TDS must not automatically clear Salary TDS or another company's TDS.

---

## 3. Existing Supabase Sources

Use these existing tables:

| Table | Purpose |
|---|---|
| `tb_companies` | Company master |
| `tb_ledgers` | TDS ledger identification and current balances |
| `tb_vouchers` | Voucher date, type, number, status and company |
| `tb_voucher_ledger_entries` | Signed ledger movements within each voucher |

Relevant relationships:

```text
tb_companies.id
    -> tb_ledgers.company_id
    -> tb_vouchers.company_id
    -> tb_voucher_ledger_entries.company_id

tb_vouchers.id
    -> tb_voucher_ledger_entries.voucher_id

tb_ledgers.id
    -> tb_voucher_ledger_entries.ledger_id
```

Exclude vouchers where any of the following is true:

- `is_cancelled = true`
- `is_deleted = true`
- `is_optional = true`

---

## 4. TDS Ledger Identification

Do not permanently rely only on ledger-name text matching. Add or maintain a configurable TDS ledger mapping with at least:

| Field | Meaning |
|---|---|
| `company_id` | Company owning the ledger |
| `ledger_id` | Corresponding `tb_ledgers.id` |
| `tds_type` | Contractor, Professional Fees, Rent, Salary, etc. |
| `section_code` | Applicable legal/reporting section |
| `is_payable_ledger` | Whether this ledger represents TDS payable |
| `rounding_tolerance` | Permitted matching difference, normally ₹1 or a configured amount |
| `active_from` | Mapping validity start date |
| `active_to` | Mapping validity end date |

For the current Medivation Jammu data, mapped ledgers include:

- `TDS on Contractor ( 194 C )`
- `TDS on Professional Fees 194 J`
- `TDS on Rent`
- `TDS on Salary`

`TDS Receivables` must not be treated as a TDS payable ledger.

---

## 5. Accounting Classification

### 5.1 Liability creation

A TDS ledger movement in a Purchase or Journal voucher normally creates or adjusts TDS liability.

Classify it as one of:

- `DEDUCTION`: increases TDS payable
- `REVERSAL`: reduces a previously created TDS liability
- `ADJUSTMENT`: manual movement requiring explanation

Do not assume every Journal entry is a fresh deduction. A Journal can also reverse or reclassify TDS.

### 5.2 Deposit/payment

A TDS ledger movement in a Payment voucher normally represents TDS deposited and reduces TDS payable.

Classify it as:

- `DEPOSIT`: available to knock off TDS liabilities
- `PAYMENT_REVERSAL`: reverses an earlier deposit
- `UNVERIFIED_PAYMENT`: payment exists in books, but challan information is unavailable

### 5.3 Normalized amounts

Store report amounts as positive values regardless of the raw Tally sign:

```text
deduction_amount = positive liability created
reversal_amount = positive liability removed
deposit_amount = positive payment available for knockoff
```

Preserve the original signed amount separately for audit and debugging.

---

## 6. Deduction Month and Due Date

Group liability creation by the calendar month of the deduction/booking date.

For a normal non-government deductor:

```text
If deduction month is April through February:
    due_date = 7th day of the following month

If deduction month is March:
    due_date = 30 April
```

The due-date engine must be configurable so statutory extensions or different deductor rules can be applied without changing report code.

Do not mark the amount delayed merely because it remains unpaid before the due date. Such an amount is `PENDING_NOT_DUE`.

---

## 7. Knockoff Rule

Use **FIFO within the same company and TDS ledger**:

> Every deposit knocks off the oldest outstanding TDS liability first.

Never knock off across:

- Different companies
- Different TDS ledgers/types
- Different legal/reporting sections unless explicitly mapped as compatible

### FIFO example

```text
April outstanding: ₹3,000
May outstanding:   ₹5,000
June deposit:       ₹6,000
```

Allocation:

```text
₹3,000 -> April liability
₹3,000 -> May liability
₹2,000 -> May remaining
```

Result:

- April: fully cleared
- May: partially cleared
- Total remaining: ₹2,000

---

## 8. Knockoff Algorithm

Process each `(company_id, tds_ledger_id)` independently in chronological order.

```text
liability_queue = []
unallocated_deposits = []

for each transaction ordered by voucher_date, voucher_id, line_number:

    if transaction creates liability:
        add a liability batch to liability_queue

    if transaction reverses liability:
        reverse the related batch when a link exists
        otherwise reduce the newest compatible open liability
        mark uncertain reversals as REVIEW_REQUIRED

    if transaction is a deposit:
        available = deposit_amount

        while available > 0 and an open liability exists:
            liability = oldest open liability
            allocated = min(available, liability.remaining_amount)

            create knockoff allocation:
                liability_id
                deposit_voucher_id
                allocated_amount
                deposit_date
                due_date
                delay_days

            liability.remaining_amount -= allocated
            available -= allocated

        if available > rounding_tolerance:
            record available as UNALLOCATED_EXCESS_PAYMENT
```

If the difference is within the configured rounding tolerance, the liability may be treated as cleared, but the rounding adjustment must be displayed.

---

## 9. Calculations

For each deduction-month batch:

```text
gross_liability = deductions - reversals

knocked_off_amount = sum(valid deposit allocations)

remaining_amount = max(gross_liability - knocked_off_amount, 0)

excess_payment = max(deposit available after all FIFO allocations, 0)
```

For the monthly ledger roll-forward:

```text
closing_outstanding =
    opening_outstanding
  + deductions
  - reversals
  - deposits_allocated
```

The next month's opening outstanding must equal the previous month's closing outstanding.

For a fully cleared batch:

```text
clearance_date = latest deposit date used to finish the batch
delay_days = max(clearance_date - due_date, 0)
```

For a partially cleared batch, store the on-time and late allocation amounts separately. Do not use only the last payment date for the entire batch.

---

## 10. Status Rules

Evaluate status **as of the report's `as_of_date`**.

| Condition | Status code | Display label |
|---|---|---|
| Fully knocked off on or before due date | `CLEARED_ON_TIME` | Cleared on time |
| Fully knocked off, but some/all payment was after due date | `CLEARED_LATE` | Cleared late |
| Partly knocked off and due date has passed | `PARTIALLY_CLEARED_OVERDUE` | Partially cleared / overdue |
| Partly knocked off and due date has not passed | `PARTIALLY_CLEARED_NOT_DUE` | Partially cleared / not due |
| Nothing knocked off and due date has passed | `UNPAID_OVERDUE` | Unpaid / overdue |
| Nothing knocked off and due date has not passed | `PENDING_NOT_DUE` | Pending / not due |
| Deposit remains after all liabilities are cleared | `EXCESS_UNALLOCATED` | Excess payment unallocated |
| Reversal, sign or ledger classification is uncertain | `REVIEW_REQUIRED` | Review required |

Overall precedence for warning display:

```text
REVIEW_REQUIRED
UNPAID_OVERDUE
PARTIALLY_CLEARED_OVERDUE
CLEARED_LATE
PENDING_NOT_DUE
CLEARED_ON_TIME
```

---

## 11. Report Filters

Required filters:

- Organization
- Company
- Financial/tax year
- From month
- To month
- As-of date
- TDS type/ledger
- Status
- Include/exclude zero-balance cleared rows
- Books status
- Challan verification status

Default behavior:

- Show all active companies available to the user
- Show the current financial/tax year
- Use today's date as the as-of date
- Include overdue and outstanding rows

---

## 12. Company Summary

Show one row per company:

| Company | Opening outstanding | TDS deducted | Reversed | Deposited | Knocked off | Remaining | Cleared late | Overdue | Excess payment |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|

Summary KPIs above the table:

- Total TDS liability created
- Total TDS deposited in books
- Total knocked off
- Total remaining
- Total overdue
- Total cleared late
- Total unallocated/excess payment
- Number of companies with overdue TDS

Do not net the total remaining of one company against excess payment in another company.

---

## 13. Company Detail

Within each company, group first by TDS type/ledger and then by deduction month.

| TDS type | Deduction month | Opening outstanding | TDS deducted | Reversed | Total due | Due date | Deposit date(s) | Deposited | Knocked off | Remaining | Excess | Delay | Status |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---:|---|

Rules:

- `Deposited` is the payment amount recorded in books for the relevant TDS ledger.
- `Knocked off` is only the portion actually allocated to liabilities.
- `Remaining` is the unpaid liability after allocations.
- `Excess` is payment not yet allocated to a liability.
- `Delay` is calculated against the statutory due date.
- Multiple deposit dates must be expandable rather than silently merged.

---

## 14. Knockoff Drill-Down

Clicking a monthly row must show the audit trail.

### Liability transactions

| Voucher date | Voucher type | Voucher number | Party | Raw signed amount | Liability created | Reversal | Classification |
|---|---|---|---|---:|---:|---:|---|

### Deposit transactions

| Deposit date | Payment voucher | Payment amount | Amount allocated | Unallocated balance | Due date | Delay days | Challan status |
|---|---|---:|---:|---:|---|---:|---|

### Allocation trail

| Liability month | Deposit voucher | Deposit date | Allocated amount | On-time amount | Late amount |
|---|---|---|---:|---:|---:|

---

## 15. Books Status vs Challan Status

Keep these as independent fields.

### Books clearance status

Derived from Tally/Supabase voucher movements:

- Cleared
- Partially cleared
- Outstanding
- Excess/unallocated
- Review required

### Challan verification status

Derived only when challan data is captured:

- Verified
- Not available
- Mismatch
- Invalid

A Payment voucher can make the books status `CLEARED`, but the challan status must remain `NOT_AVAILABLE` until challan information is verified.

Never label a row “statutorily compliant” based only on a Tally Payment voucher.

---

## 16. Opening Outstanding

The report must not start every financial year at zero.

For the selected start date:

```text
opening_outstanding =
    all earlier liability movements
  - all earlier valid knockoff allocations
```

Older outstanding amounts must enter the FIFO queue before current-period liabilities.

Display brought-forward amounts separately so that a current-month deposit can correctly knock off an older balance.

---

## 17. Reversals and Corrections

Handle these explicitly:

- Cancelled voucher: exclude it
- Deleted voucher: exclude it
- Optional voucher: exclude it by default
- Liability reversal: reduce the related liability
- Payment reversal: restore the corresponding liability
- Voucher altered after a previous sync: recompute affected allocations
- Backdated voucher: recompute FIFO from the backdated transaction onward
- Ledger reclassification: preserve history and rerun the affected company/ledger

FIFO results must be deterministic and safely recomputable.

---

## 18. Rounding

Use a configurable tolerance per TDS ledger.

Example:

```text
Liability: ₹39,621
Payment:   ₹39,622
Tolerance: ₹1
```

Result:

- Liability cleared: ₹39,621
- Rounding/excess: ₹1
- Remaining liability: ₹0

Never hide the difference. Display it as rounding or unallocated excess.

---

## 19. Delay and Interest

The main report must calculate:

- Due date
- Deposit date
- Days late
- Amount paid late
- Amount still overdue

Interest should be a separate calculated field because statutory late-payment interest is generally based on months or parts of months, not a simple daily rate.

If the complete legal interest engine has not been implemented, show:

```text
Interest status: Calculation not implemented / Requires verification
```

Do not display an estimated interest figure as final statutory interest.

---

## 20. Suggested Database Objects

Create normalized reporting objects such as:

### `tds_ledger_mappings`

Maps company ledgers to TDS types and rules.

### `tds_liability_batches`

Stores or materializes each liability batch:

```text
id
company_id
ledger_id
deduction_month
source_voucher_id
liability_date
due_date
original_amount
reversal_amount
remaining_amount
status
```

### `tds_deposit_batches`

```text
id
company_id
ledger_id
payment_voucher_id
deposit_date
deposit_amount
unallocated_amount
challan_verification_status
```

### `tds_knockoff_allocations`

```text
id
liability_batch_id
deposit_batch_id
allocated_amount
due_date
deposit_date
delay_days
created_at
```

These can be tables, materialized views or computed query outputs depending on performance and audit requirements.

---

## 21. Colour and Alert Rules

| Status | Colour |
|---|---|
| Cleared on time | Green |
| Pending, not due | Blue |
| Cleared late | Amber |
| Partially cleared / overdue | Orange |
| Unpaid / overdue | Red |
| Review required | Purple |
| Excess/unallocated | Grey |

Do not use colour as the only indicator; always show the text status.

---

## 22. Export Requirements

Allow export to CSV/XLSX with:

- All active filters
- Company summary
- Company/TDS/month detail
- Deposit voucher details
- FIFO allocation trail
- Outstanding and overdue totals
- Report generation timestamp
- As-of date
- Disclaimer stating whether challans were verified

---

## 23. Validation Checks

For every company and TDS ledger:

```text
Opening outstanding
+ Deductions
- Reversals
- Knocked-off deposits
= Closing outstanding
```

Also validate:

1. A deposit allocation never exceeds the deposit amount.
2. A liability allocation never exceeds the liability amount.
3. No allocation crosses companies.
4. No allocation crosses incompatible TDS ledgers.
5. All allocation amounts are positive.
6. Next month's opening equals previous month's closing.
7. Summary totals equal detail totals.
8. Current reconstructed closing agrees with the TDS ledger balance, subject to identified adjustments/sign conventions.
9. Backdated and altered vouchers cause affected allocations to be recomputed.

---

## 24. Acceptance Examples

### Example A: Cleared on time

```text
June deduction: ₹1,231
Due date: 7 July
Deposit: ₹1,231 on 7 July
```

Expected:

```text
Knocked off: ₹1,231
Remaining: ₹0
Delay: 0
Status: CLEARED_ON_TIME
```

### Example B: Cleared late

```text
August deduction: ₹39,621
Due date: 7 September
Deposit: ₹39,622 on 8 September
```

Expected:

```text
Knocked off: ₹39,621
Remaining: ₹0
Excess/rounding: ₹1
Delay: 1 day
Status: CLEARED_LATE
```

### Example C: Partially cleared

```text
Deduction: ₹10,000
Deposit: ₹7,000
```

Expected:

```text
Knocked off: ₹7,000
Remaining: ₹3,000
Status after due date: PARTIALLY_CLEARED_OVERDUE
```

### Example D: Older liability cleared first

```text
April outstanding: ₹3,000
May deduction: ₹5,000
June deposit: ₹6,000
```

Expected:

```text
April knocked off: ₹3,000
May knocked off: ₹3,000
May remaining: ₹2,000
```

### Example E: Not yet due

```text
Deduction: ₹5,000
Due date: 7 September
Report as-of date: 31 August
No deposit yet
```

Expected:

```text
Remaining: ₹5,000
Status: PENDING_NOT_DUE
```

---

## 25. Final Report Meaning

The report must make this conclusion obvious for every company and every TDS type:

```text
TDS liability created
-> deposit found or not found
-> deposit knocked off against oldest liability
-> remaining balance calculated
-> due date compared with deposit date
-> clearance and delay status displayed
```

The primary management question is:

> **Has every TDS liability been fully cleared by its due date? If not, how much remains, since when, and for which company and TDS ledger?**

