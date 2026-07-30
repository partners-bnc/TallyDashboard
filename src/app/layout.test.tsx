import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Providers } from './providers'

describe('root theme foundation', () => {
  it('renders children inside the light Astryx provider', () => {
    const { getByText } = render(<Providers><span>Dashboard shell</span></Providers>)
    expect(getByText('Dashboard shell')).toBeInTheDocument()
  })
})

