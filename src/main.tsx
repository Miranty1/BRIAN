import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigError } from './components/ConfigError'
import { checkEnv } from './lib/env'
import './theme/global.css'

const root = createRoot(document.getElementById('root')!)
const config = checkEnv(import.meta.env)

if (!config.ok) {
  console.error(`Invalid or missing env vars: ${config.invalid.join(', ')}`)
  root.render(<ConfigError invalid={config.invalid} />)
} else {
  // Loaded only once settings are valid: the Supabase client reads them at import time.
  import('./App').then(({ App }) =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
}
