'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { login, type LoginState } from './actions'

import illustration from '@/assets/mX2lljSONA.svg'
import styles from './login.module.css'

export default function LoginPage() {
  const [state, formAction, busy] = useActionState<LoginState, FormData>(login, { error: '' })

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

          <form action={formAction} className="w-full flex flex-col gap-4 text-left">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-inter">
                Email Address
              </label>
              <input 
                type="email" 
                name="email"
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
                name="password"
                required 
                autoComplete="current-password" 
                className="w-full h-11 px-4 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-inter text-slate-900 text-sm"
                placeholder="••••••••"
              />
            </div>

            {state.error && (
              <p role="alert" className="text-xs text-red-500 font-medium font-inter mt-1">
                {state.error}
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
