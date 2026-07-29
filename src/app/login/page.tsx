'use client'

import { FormEvent, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@astryxdesign/core/Button'
import { getPublicEnv } from '@/lib/env'
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
        window.location.assign('/')
      }
    } catch (reason) {
      setError(reason instanceof Error && /Invalid input|NEXT_PUBLIC_SUPABASE/i.test(reason.message)
        ? 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.'
        : 'Could not reach Supabase. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }
  return <main className={styles.page}><section className={styles.panel}><div className={styles.brand}><span className={styles.mark}>TB</span><span>TallyBridge</span></div><div><p className={styles.kicker}>Executive reporting</p><h1>Make the ledger legible.</h1><p className={styles.lede}>Sign in to review synchronized accounting activity across your organizations.</p></div><form onSubmit={submit} className={styles.form}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>{error && <p role="alert" className={styles.error}>{error}</p>}<Button label={busy ? 'Signing in…' : 'Sign in'} type="submit" isDisabled={busy} width="100%" /></form><p className={styles.note}>Access is read-only and protected by your existing TallyBridge organization membership.</p></section><aside className={styles.aside}><div className={styles.asideRule} /><p>One source of truth</p><strong>Decisions start with a reconciled view.</strong><span>All amounts are shown in INR and follow Tally debit / credit semantics.</span></aside></main>
}
