import { Link } from 'react-router-dom'

import { Button } from '../components/ui'

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <p className="font-pixel text-5xl text-retro-red text-shadow-pixel">404</p>
      <h1 className="mt-8 h-section">
        This lot doesn&apos;t exist
      </h1>
      <p className="mt-4 text-sm text-slate/80">
        The page you were looking for has been sold, paused or never existed.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/">
          <Button variant="dark">← Home</Button>
        </Link>
        <Link to="/marketplace">
          <Button>Browse Stocklots</Button>
        </Link>
      </div>
    </div>
  )
}
