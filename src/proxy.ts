import { auth } from '@/lib/auth/server'

export default auth.middleware({ loginUrl: '/login' })

export const config = {
  matcher: ['/dashboard/:path*', '/api/ledger/:path*', '/api/voucher/:path*', '/api/compliance/:path*'],
}
