import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getPublicEnv } from '@/lib/env'

export async function POST() {
  const cookieStore = await cookies()
  const env = getPublicEnv()
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => cookieStore.getAll(), setAll: (items) => items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } })
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
