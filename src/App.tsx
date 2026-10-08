import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppShell } from '@/components/AppShell'
import { Home } from '@/routes/Home'
import { Login } from '@/routes/Login'
import { Play } from '@/routes/Play'
import { Settings } from '@/routes/Settings'
import { Stats } from '@/routes/Stats'
import { ThemeProvider } from '@/theme/ThemeProvider'

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<Home />} />
                <Route path="play" element={<Play />} />
                <Route path="stats" element={<Stats />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
