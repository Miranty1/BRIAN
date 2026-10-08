import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from './ThemeProvider'

function Probe() {
  const { theme, toggleTheme } = useTheme()
  return <button onClick={toggleTheme}>{theme}</button>
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  vi.restoreAllMocks()
})

describe('ThemeProvider', () => {
  it('defaults to dark and stamps data-theme on <html>', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByRole('button')).toHaveTextContent('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('toggles to light and persists the choice', async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveTextContent('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('brian.theme')).toBe('light')
  })

  it('restores a saved theme', () => {
    localStorage.setItem('brian.theme', 'light')
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByRole('button')).toHaveTextContent('light')
  })

  it('still works when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByRole('button')).toHaveTextContent('dark')
    await act(() => userEvent.click(screen.getByRole('button')))
    expect(screen.getByRole('button')).toHaveTextContent('light')
  })
})
