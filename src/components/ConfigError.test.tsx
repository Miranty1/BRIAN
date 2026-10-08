import { render, screen } from '@testing-library/react'
import { ConfigError } from './ConfigError'

describe('ConfigError', () => {
  it('names each problem setting and says where to fix it', () => {
    render(<ConfigError invalid={['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']} />)
    expect(screen.getByRole('heading')).toHaveTextContent('BRIAN can’t connect')
    expect(screen.getByText('VITE_SUPABASE_URL')).toBeInTheDocument()
    expect(screen.getByText('VITE_SUPABASE_ANON_KEY')).toBeInTheDocument()
    expect(screen.getByText(/\.env\.local/)).toBeInTheDocument()
    expect(screen.getByText(/Redeploy/)).toBeInTheDocument()
  })
})
