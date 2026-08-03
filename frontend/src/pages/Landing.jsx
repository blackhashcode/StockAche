import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import ProductCard from '../components/ProductCard'
import { Button, Card } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

const PROBLEMS = [
  {
    icon: '✕',
    title: 'Scattered on Facebook',
    text: 'Lots buried in groups and WhatsApp threads. Finding the right GSM at the right MOQ takes days.',
  },
  {
    icon: '?',
    title: 'Nobody knows who is real',
    text: 'No trade licence checks, no NID. Advance payments disappear and there is no recourse.',
  },
  {
    icon: '⋯',
    title: 'Zero order visibility',
    text: 'After paying, buyers chase updates by phone. No dispatch status, no delivery estimate.',
  },
]

const STEPS = [
  { n: '01', title: 'Search the feed', text: 'Filter by GSM, fabric category, MOQ range and unit price.' },
  { n: '02', title: 'Check the badge', text: 'Verified suppliers have submitted a trade licence and NID.' },
  { n: '03', title: 'Calculate the total', text: 'Quantity × unit price + transport, before you commit.' },
  { n: '04', title: 'Track to your door', text: 'Placed → Confirmed → Dispatched → In Transit → Delivered.' },
]

export default function Landing() {
  const [featured, setFeatured] = useState([])
  const { isAuthenticated, role } = useAuth()

  useEffect(() => {
    api
      .products({ ordering: '-created_at', page: 1 })
      .then((data) => setFeatured((data.results || []).slice(0, 4)))
      .catch(() => setFeatured([]))
  }, [])

  const homeLink = !isAuthenticated ? '/login' : role === 'supplier' ? '/supplier' : '/marketplace'

  return (
    <div>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden border-b-[3px] border-ink bg-retro-navy">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,rgba(255,255,255,.12) 0 2px,transparent 2px 6px)',
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-16 md:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <span className="pixel-tag bg-retro-yellow">▶ Stock-Lot RMG Marketplace</span>

              <h1 className="mt-5 font-pixel text-2xl leading-[1.7] text-paper text-shadow-pixel sm:text-3xl sm:leading-[1.7] md:text-4xl md:leading-[1.6]">
                Buy garment
                <br />
                stocklots
                <br />
                <span className="text-retro-yellow">without the</span>
                <br />
                <span className="text-retro-red">guesswork.</span>
              </h1>

              <p className="mt-6 max-w-lg text-base leading-relaxed text-paper/85">
                StockAche connects small online garment stores in Bangladesh with verified
                stocklot wholesalers. Real MOQs, real prices, real tracking — instead of a
                thousand unanswered WhatsApp messages.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/marketplace">
                  <Button size="lg" variant="secondary">
                    Browse Stocklots
                  </Button>
                </Link>
                <Link to={homeLink}>
                  <Button size="lg" variant="success">
                    {isAuthenticated ? 'Go to Dashboard' : 'Start Selling'}
                  </Button>
                </Link>
              </div>

              <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
                {[
                  ['5', 'Milestones'],
                  ['3', 'Pay Methods'],
                  ['11', 'Categories'],
                ].map(([value, label]) => (
                  <div key={label} className="border-[3px] border-ink bg-paper p-3 shadow-pixel">
                    <p className="font-term text-3xl leading-none text-retro-red">{value}</p>
                    <p className="mt-1 font-pixel text-[7px] uppercase tracking-wider text-slate">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Fake "terminal" panel */}
            <div className="scanlines relative border-4 border-ink bg-ink p-1 shadow-pixel-lg">
              <div className="flex items-center gap-2 border-b-2 border-slate px-3 py-2">
                <span className="h-3 w-3 border-2 border-paper bg-retro-red" />
                <span className="h-3 w-3 border-2 border-paper bg-retro-yellow" />
                <span className="h-3 w-3 border-2 border-paper bg-retro-green" />
                <span className="ml-2 font-pixel text-[8px] uppercase text-paper/60">
                  stockache://order/SA-7E547715
                </span>
              </div>
              <div className="space-y-1 p-4 font-term text-lg leading-tight text-retro-green">
                <p>&gt; searching lots... gsm=180 moq&lt;=150</p>
                <p className="text-paper">&gt; 24 lots found in 0.31s</p>
                <p>&gt; supplier: Hossain Stocklot House</p>
                <p className="text-retro-yellow">&gt; trade licence: VERIFIED ✔</p>
                <p className="text-paper">&gt; 200 pcs × ৳165 + ৳1,800 transport</p>
                <p className="text-retro-yellow">&gt; total: ৳34,800</p>
                <p>&gt; payment: bKash ... ACCEPTED</p>
                <p className="text-paper">&gt; status: DISPATCHED VIA TRUCK</p>
                <p>
                  &gt; eta: 24h<span className="animate-blink">█</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Problem ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-center font-pixel text-lg uppercase leading-relaxed">
          The stocklot trade runs on <span className="text-retro-red">trust it can&apos;t verify</span>
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PROBLEMS.map((problem) => (
            <Card key={problem.title} className="border-t-8 border-t-retro-red">
              <span className="grid h-11 w-11 place-items-center border-[3px] border-ink bg-retro-red font-pixel text-sm text-paper">
                {problem.icon}
              </span>
              <h3 className="mt-4 font-pixel text-[11px] uppercase leading-relaxed">
                {problem.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate/85">{problem.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="border-y-[3px] border-ink bg-parchment">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-center font-pixel text-lg uppercase">How It Works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.n} className="relative border-[3px] border-ink bg-paper p-5 shadow-pixel">
                <span className="absolute -top-4 left-4 border-[3px] border-ink bg-retro-blue px-2 py-1 font-pixel text-[10px] text-paper">
                  {step.n}
                </span>
                <h3 className="mt-3 font-pixel text-[10px] uppercase leading-relaxed">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate/85">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Featured ---------------- */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-pixel text-lg uppercase">
              <span className="text-retro-red">▸ </span>Fresh Lots
            </h2>
            <Link to="/marketplace">
              <Button variant="dark" size="sm">
                See All →
              </Button>
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Split CTA ---------------- */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="border-[3px] border-ink bg-retro-green p-8 shadow-pixel-lg">
            <span className="pixel-tag bg-paper">For Buyers</span>
            <h3 className="mt-4 font-pixel text-sm uppercase leading-relaxed">
              Stock your shop in minutes
            </h3>
            <p className="mt-3 text-sm leading-relaxed">
              Filter by spec, check verification, calculate your landed cost, then track the
              truck to your door.
            </p>
            <Link to="/marketplace" className="mt-6 inline-block">
              <Button variant="dark">Browse the Feed</Button>
            </Link>
          </div>

          <div className="border-[3px] border-ink bg-retro-purple p-8 text-paper shadow-pixel-lg">
            <span className="pixel-tag bg-paper text-ink">For Suppliers</span>
            <h3 className="mt-4 font-pixel text-sm uppercase leading-relaxed">
              Move dead stock, faster
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-paper/90">
              List a lot in under two minutes, get a verified badge, and manage dispatch from
              one dashboard.
            </p>
            <Link to="/login" className="mt-6 inline-block">
              <Button variant="secondary">List a Stocklot</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
