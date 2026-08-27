import { AppShell } from '@astryxdesign/core/AppShell'
import { Spinner } from '@astryxdesign/core/Spinner'
import Header from '@/components/ui/Header'

export default function DashboardLoading() {
  return (
    <AppShell topNav={<Header />} mobileNav={false} contentPadding={4}>
      <Spinner size="lg" shade="subtle" label="Loading workspace…" />
    </AppShell>
  )
}
