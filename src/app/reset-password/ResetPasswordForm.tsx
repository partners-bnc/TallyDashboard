'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { VStack } from '@astryxdesign/core/Layout'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Heading, Text } from '@astryxdesign/core/Text'
import { authClient } from '@/lib/auth/client'

type ResetPasswordFormProps = {
  token: string
  tokenError: string
}

export function ResetPasswordForm({ token, tokenError }: ResetPasswordFormProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  const hasValidToken = Boolean(token) && tokenError !== 'INVALID_TOKEN'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!hasValidToken) {
      setError('This reset link is invalid or has expired. Request a new link and try again.')
      return
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }

    setBusy(true)
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      })

      if (result.error) {
        setError(
          /invalid token/i.test(result.error.message ?? '')
            ? 'This reset link is invalid or has expired. Request a new link and try again.'
            : result.error.message || 'The password could not be updated. Try again.',
        )
        return
      }

      setPassword('')
      setConfirmation('')
      setComplete(true)
    } catch {
      setError('Could not reach Neon Auth. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell contentPadding={4} height="fill" variant="wash">
      <Center width="100%" height="100%">
        <Card width="100%" maxWidth={440} padding={8}>
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>Set a new password</Heading>
              <Text type="supporting" color="secondary">
                Choose a new password for your TallyOne Ai account.
              </Text>
            </VStack>

            {complete ? (
              <VStack gap={4}>
                <Banner
                  status="success"
                  title="Password updated"
                  description="You can now sign in with your new password."
                />
                <Button
                  label="Continue to sign in"
                  variant="primary"
                  width="100%"
                  clickAction={() => router.replace('/login')}
                />
              </VStack>
            ) : (
              <form onSubmit={submit}>
                <FormLayout>
                  {!hasValidToken && (
                    <Banner
                      status="error"
                      title="Reset link unavailable"
                      description="This link is invalid or has expired. Request a fresh password-reset email."
                    />
                  )}
                  {error && <Banner status="error" title="Password not updated" description={error} />}
                  <TextInput
                    type="password"
                    label="New password"
                    value={password}
                    onChange={setPassword}
                    description="Use at least 8 characters."
                    isRequired
                    isDisabled={!hasValidToken || busy}
                  />
                  <TextInput
                    type="password"
                    label="Confirm new password"
                    value={confirmation}
                    onChange={setConfirmation}
                    isRequired
                    isDisabled={!hasValidToken || busy}
                  />
                  <Button
                    label="Set new password"
                    type="submit"
                    variant="primary"
                    width="100%"
                    isLoading={busy}
                    isDisabled={!hasValidToken}
                  />
                </FormLayout>
              </form>
            )}
          </VStack>
        </Card>
      </Center>
    </AppShell>
  )
}
