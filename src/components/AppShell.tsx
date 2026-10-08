import { NavLink, Outlet } from 'react-router-dom'
import { PlayIcon, SettingsIcon, StatsIcon, TodayIcon } from './NavIcons'
import styles from './AppShell.module.css'

const NAV = [
  { to: '/', label: 'Today', Icon: TodayIcon, end: true },
  { to: '/play', label: 'Play', Icon: PlayIcon, end: false },
  { to: '/stats', label: 'Stats', Icon: StatsIcon, end: false },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon, end: false },
]

export function AppShell() {
  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Main">
        <span className={styles.wordmark}>BRIAN</span>
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
