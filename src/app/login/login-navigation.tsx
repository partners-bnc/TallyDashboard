'use client'

import { useEffect } from 'react'
import { replaceDocument } from '@/lib/document-navigation'

export function LoginNavigation({ success }: { success: boolean }) {
  useEffect(() => {
    if (success) replaceDocument('/dashboard')
  }, [success])

  return null
}
