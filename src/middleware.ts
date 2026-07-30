import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getPublicEnv } from '@/lib/env'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const env = getPublicEnv()
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => { request.cookies.set(name, value); response = NextResponse.next({ request }); response.cookies.set(name, value, options) }),
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const isPublicPath = pathname === '/' || pathname === '/login'
  
  if (!user && !isPublicPath) return NextResponse.redirect(new URL('/login', request.url))
  if (user && pathname === '/login') return NextResponse.redirect(new URL('/dashboard', request.url))
  
  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
