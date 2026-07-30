'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { getPublicEnv } from '@/lib/env'

import illustration from '@/assets/mX2lljSONA.svg'
import styles from './login.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const env = getPublicEnv()
      const supabase = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (result.error) {
        setError(/invalid login credentials/i.test(result.error.message) ? 'Incorrect email or password.' : 'Sign-in failed. Try again.')
      } else {
        window.location.assign('/dashboard')
      }
    } catch (reason) {
      setError(reason instanceof Error && /Invalid input|NEXT_PUBLIC_SUPABASE/i.test(reason.message)
        ? 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.'
        : 'Could not reach Supabase. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className="absolute top-8 left-8 md:left-12">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/5e4a8a19-f7b5-4e29-89a9-ad9d693b6111.png"
              alt="TallyOne Ai"
              style={{ width: 180, height: 52, objectFit: 'contain', mixBlendMode: 'multiply' }}
            />
          </Link>
        </div>

        <div className="flex flex-col items-center text-center max-w-sm w-full mx-auto mt-16 md:mt-0">
          <div className="mb-8 w-full">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2 font-inter">
              Welcome back
            </h1>
            <p className="text-sm text-slate-500 font-inter">
              Sign in to manage Tally accounting, MIS reporting, and email triggers.
            </p>
          </div>

          <form onSubmit={submit} className="w-full flex flex-col gap-4 text-left">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-inter">
                Email Address
              </label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                autoComplete="email" 
                className="w-full h-11 px-4 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-inter text-slate-900 text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-inter">
                Password
              </label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                autoComplete="current-password" 
                className="w-full h-11 px-4 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-inter text-slate-900 text-sm"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs text-red-500 font-medium font-inter mt-1">
                {error}
              </p>
            )}

            <button 
              type="submit" 
              disabled={busy}
              className="w-full h-11 bg-primary hover:bg-primary/95 text-white font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center text-sm font-inter mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-xs text-slate-400 font-inter mt-8 max-w-xs leading-relaxed">
            Access is read-only and secured by your existing TallyOne Ai organization membership.
          </p>
        </div>
      </section>

      <aside className={styles.aside}>
        <div className="w-full flex-grow flex items-center justify-center p-8">
          <img 
            src={typeof illustration === 'string' ? illustration : illustration.src} 
            alt="Animated Illustration" 
            className="w-full max-w-[320px] aspect-square object-contain"
          />
        </div>
        <div className="max-w-md mt-auto">
          <div className="w-12 h-0.5 bg-white/70 mb-6" />
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-3 font-inter">
            One source of truth
          </p>
          <strong className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight text-white mb-4 block font-inter">
            Decisions start with a reconciled view.
          </strong>
          <span className="text-sm text-white/70 leading-relaxed block font-inter">
            All amounts are shown in INR and follow Tally local / cloud database debit and credit semantics.
          </span>
        </div>
      </aside>
    </main>
  )
}
