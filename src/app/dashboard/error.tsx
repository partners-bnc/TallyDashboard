'use client'

import { AppShell } from '@astryxdesign/core/AppShell'
import { Button } from '@astryxdesign/core/Button'
import Header from '@/components/ui/Header'

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppShell topNav={<Header />} mobileNav={false} contentPadding={4}>
      <section aria-labelledby="dashboard-error-title">
        <h1 id="dashboard-error-title">Workspace data is temporarily unavailable</h1>
        <p>The request was not retried automatically. Try again when you are ready.</p>
        <Button label="Try again" onClick={reset} />
      </section>
    </AppShell>
  )
}
