import type { Session } from '@supabase/supabase-js'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthState } from './AuthProvider'
import { RequireAuth } from './RequireAuth'

function renderAt(state: AuthState) {
  return render(
    <AuthContext.Provider value={state}>
      <MemoryRouter initialEntries={['/stats']}>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route element={<RequireAuth />}>
            <Route path="/stats" element={<p>secret stats</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RequireAuth', () => {
  it('redirects to /login when signed out', () => {
    renderAt({ session: null, loading: false })
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('renders the protected route when signed in', () => {
    renderAt({ session: { user: { id: 'u1' } } as Session, loading: false })
    expect(screen.getByText('secret stats')).toBeInTheDocument()
  })

  it('renders neither while the session is loading', () => {
    renderAt({ session: null, loading: true })
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
    expect(screen.queryByText('secret stats')).not.toBeInTheDocument()
  })
})
