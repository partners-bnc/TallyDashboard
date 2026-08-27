export type WorkspaceContext = {
  orgId?: string | null
  companyId?: string | null
  from?: string | null
  to?: string | null
}

type QueryValue = string | null | undefined

export function queryString(values: Record<string, QueryValue>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value)
  }
  return params.toString()
}

export function dashboardUrl(
  path: `/dashboard${string}`,
  context: WorkspaceContext = {},
  extra: Record<string, QueryValue> = {},
): string {
  const query = queryString({
    org: context.orgId,
    company: context.companyId,
    from: context.from,
    to: context.to,
    ...extra,
  })
  return query ? `${path}?${query}` : path
}

export const workspaceSelectorUrl = (orgId?: string | null) =>
  dashboardUrl('/dashboard', { orgId })

export const overviewUrl = (context: WorkspaceContext) =>
  dashboardUrl('/dashboard/overview', context)
