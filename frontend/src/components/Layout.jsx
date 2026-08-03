import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { Button, cx } from './ui'

const BUYER_LINKS = [
  { to: '/marketplace', label: 'Market' },
  { to: '/orders', label: 'My Orders' },
  { to: '/buyer/profile', label: 'Profile' },
]

const SUPPLIER_LINKS = [
  { to: '/supplier', label: 'Dashboard' },
  { to: '/supplier/listings', label: 'Listings' },
  { to: '/supplier/orders', label: 'Orders' },
  { to: '/supplier/profile', label: 'Profile' },
]

function Ticker() {
  const items = [
    'VERIFIED SUPPLIERS',
    'CLEAR MOQ',
    'LIVE ORDER TRACKING',
    'bKASH / CARD / COD',
    'NO MORE WHATSAPP CHAOS',
  ]
  // Duplicated so the -50% translate loops seamlessly.
  const strip = [...items, ...items, ...items, ...items]
  return (
    <div className="overflow-hidden border-b-[3px] border-ink bg-retro-yellow py-1.5">
      <div className="flex w-max animate-marquee gap-8 whitespace-nowrap">
        {strip.map((item, i) => (
          <span key={i} className="font-pixel text-[8px] uppercase tracking-wider text-ink">
            ★ {item}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Navbar() {
  const { account, isAuthenticated, role, logout, isDemoSession } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])

  const links = role === 'supplier' ? SUPPLIER_LINKS : BUYER_LINKS

  const linkClass = ({ isActive }) =>
    cx(
      'border-[3px] border-ink px-3 py-2 font-pixel text-[9px] uppercase tracking-wider transition-transform duration-75',
      isActive
        ? 'bg-ink text-paper shadow-none translate-x-[2px] translate-y-[2px]'
        : 'bg-paper text-ink shadow-pixel-sm hover:bg-retro-yellow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
    )

  return (
    <header className="sticky top-0 z-40">
      <Ticker />
      <nav className="border-b-[3px] border-ink bg-paper">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/" className="group flex shrink-0 items-center gap-2">
            <span className="grid h-9 w-9 place-items-center border-[3px] border-ink bg-retro-red font-pixel text-xs text-paper shadow-pixel-sm transition-transform group-hover:-translate-y-0.5">
              S
            </span>
            <span className="font-pixel text-xs uppercase tracking-tight">
              Stock<span className="text-retro-red">Ache</span>
              <span className="animate-blink text-retro-blue">?</span>
            </span>
          </Link>

          <div className="ml-auto hidden items-center gap-2 md:flex">
            {isAuthenticated ? (
              <>
                {links.map((link) => (
                  <NavLink key={link.to} to={link.to} className={linkClass} end={link.to === '/supplier'}>
                    {link.label}
                  </NavLink>
                ))}
                <div className="ml-2 flex items-center gap-2 border-[3px] border-ink bg-parchment px-3 py-1.5 shadow-pixel-sm">
                  <span
                    className={cx(
                      'h-2.5 w-2.5 border border-ink',
                      role === 'supplier' ? 'bg-retro-purple' : 'bg-retro-green',
                    )}
                  />
                  <span className="max-w-[9rem] truncate text-xs font-medium">
                    {account?.buyer_profile?.business_name ||
                      account?.supplier_profile?.business_name ||
                      account?.full_name ||
                      account?.email}
                  </span>
                </div>
                <Button variant="dark" size="sm" onClick={logout}>
                  Exit
                </Button>
              </>
            ) : (
              <>
                <NavLink to="/marketplace" className={linkClass}>
                  Browse
                </NavLink>
                <Link to="/login">
                  <Button size="sm">Sign In</Button>
                </Link>
              </>
            )}
          </div>

          <button
            className="pixel-btn ml-auto bg-ink px-3 py-2 text-paper md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? '✕' : '☰'}
          </button>
        </div>

        {open && (
          <div className="border-t-[3px] border-ink bg-parchment px-4 py-3 md:hidden">
            <div className="flex flex-col gap-2">
              {(isAuthenticated ? links : [{ to: '/marketplace', label: 'Browse' }]).map(
                (link) => (
                  <NavLink key={link.to} to={link.to} className={linkClass} end={link.to === '/supplier'}>
                    {link.label}
                  </NavLink>
                ),
              )}
              {isAuthenticated ? (
                <Button variant="dark" size="sm" onClick={logout}>
                  Sign Out
                </Button>
              ) : (
                <Link to="/login">
                  <Button size="sm" className="w-full">
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {isDemoSession && (
        <div className="border-b-[3px] border-ink bg-retro-purple px-4 py-1 text-center">
          <span className="font-pixel text-[8px] uppercase tracking-wider text-paper">
            Demo session — seeded data, mock payments
          </span>
        </div>
      )}
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-16 border-t-[3px] border-ink bg-ink text-paper">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-pixel text-sm">
            Stock<span className="text-retro-red">Ache</span>
            <span className="text-retro-blue">?</span>
          </p>
          <p className="mt-3 max-w-xs text-sm text-paper/70">
            A stocklot marketplace and order tracker connecting RMG wholesalers to small
            online garment stores across Bangladesh.
          </p>
        </div>
        <div>
          <p className="font-pixel text-[10px] uppercase tracking-wider text-retro-yellow">
            Platform
          </p>
          <ul className="mt-3 space-y-2 text-sm text-paper/70">
            <li>
              <Link to="/marketplace" className="hover:text-retro-yellow">
                Browse Stocklots
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-retro-yellow">
                Sell on StockAche
              </Link>
            </li>
            <li>
              <Link to="/orders" className="hover:text-retro-yellow">
                Track an Order
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-pixel text-[10px] uppercase tracking-wider text-retro-yellow">
            Prototype
          </p>
          <p className="mt-3 text-sm text-paper/70">
            Payments run in mock mode. bKash, card and COD flows are simulated end to end
            until live gateway credentials are added.
          </p>
        </div>
      </div>
      <div className="border-t-[3px] border-slate px-4 py-4 text-center">
        <p className="font-pixel text-[8px] uppercase tracking-wider text-paper/50">
          © 2026 StockAche — Hackathon Prototype
        </p>
      </div>
    </footer>
  )
}

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
