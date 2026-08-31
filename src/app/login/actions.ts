'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth/server'

export type LoginState = { error: string; success: boolean }

export async function login(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) return { error: 'Enter your email address and password.', success: false }

  try {
    const result = await auth.signIn.email({ email, password })
    if (result.error) {
      return {
        error: /invalid login credentials/i.test(result.error.message ?? '')
          ? 'Incorrect email or password.'
          : 'Sign-in failed. Try again.',
        success: false,
      }
    }
  } catch (reason) {
    return {
      error: reason instanceof Error && /Invalid input|NEON_AUTH/i.test(reason.message)
        ? 'Neon Auth is not configured correctly. Contact your administrator.'
        : 'Could not reach Neon Auth. Check your connection and try again.',
      success: false,
    }
  }

  // Authentication changes the RLS identity used by every dashboard query.
  // Discard any page payload created before the new session cookie existed.
  revalidatePath('/dashboard', 'layout')
  return { error: '', success: true }
}
