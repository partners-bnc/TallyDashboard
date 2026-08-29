import { ResetPasswordForm } from './ResetPasswordForm'

type ResetPasswordPageProps = {
  searchParams: Promise<{
    error?: string | string[]
    token?: string | string[]
  }>
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const query = await searchParams
  const token = typeof query.token === 'string' ? query.token : ''
  const tokenError = typeof query.error === 'string' ? query.error : ''

  return <ResetPasswordForm token={token} tokenError={tokenError} />
}
