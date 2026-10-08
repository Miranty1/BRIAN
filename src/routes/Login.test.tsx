import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '@/auth/AuthProvider'
import { Login } from './Login'

const signInWithOtp = vi.fn()
const verifyOtp = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...a: unknown[]) => signInWithOtp(...a),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
    },
  },
}))

function renderLogin() {
  return render(
    <AuthContext.Provider value={{ session: null, loading: false }}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

async function requestCode(email = 'me@example.com') {
  await userEvent.type(screen.getByLabelText('Email'), email)
  await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in code' }))
}

beforeEach(() => {
  signInWithOtp.mockReset().mockResolvedValue({ error: null })
  verifyOtp.mockReset().mockResolvedValue({ error: null })
})

describe('Login', () => {
  it('sends the email, then asks for the code', async () => {
    renderLogin()
    await requestCode()
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'me@example.com',
      options: { emailRedirectTo: window.location.origin },
    })
    expect(screen.getByLabelText('Code from the email')).toHaveAttribute(
      'autocomplete',
      'one-time-code',
    )
  })

  it('verifies the typed code against the same email', async () => {
    renderLogin()
    await requestCode()
    await userEvent.type(screen.getByLabelText('Code from the email'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'me@example.com',
      token: '123456',
      type: 'email',
    })
  })

  it('strips spaces from a pasted code', async () => {
    renderLogin()
    await requestCode()
    await userEvent.type(screen.getByLabelText('Code from the email'), '123 456')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(verifyOtp).toHaveBeenCalledWith(expect.objectContaining({ token: '123456' }))
  })

  it('explains a wrong or expired code and keeps the code step open', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } })
    renderLogin()
    await requestCode()
    await userEvent.type(screen.getByLabelText('Code from the email'), '000000')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('alert')).toHaveTextContent('That code is wrong or has expired')
    expect(screen.getByLabelText('Code from the email')).toBeInTheDocument()
  })

  it('can resend and can go back to change the email', async () => {
    renderLogin()
    await requestCode()
    await userEvent.click(screen.getByRole('button', { name: 'Send a new code' }))
    expect(signInWithOtp).toHaveBeenCalledTimes(2)
    await userEvent.click(screen.getByRole('button', { name: 'Use a different email' }))
    expect(screen.getByLabelText('Email')).toHaveValue('me@example.com')
  })

  it('shows why sending failed', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'Email rate limit exceeded' } })
    renderLogin()
    await requestCode()
    expect(screen.getByRole('alert')).toHaveTextContent('Email rate limit exceeded')
  })
})
