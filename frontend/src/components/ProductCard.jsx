import { Link } from 'react-router-dom'

import { bdt, pcs } from '../lib/format'
import PixelImage from './PixelImage'
import { Tag } from './ui'

export function VerifiedBadge({ verified, className = '' }) {
  return verified ? (
    <Tag color="bg-retro-green" className={className}>
      ✔ Verified
    </Tag>
  ) : (
    <Tag color="bg-retro-grey" className={className}>
      Unverified
    </Tag>
  )
}

export default function ProductCard({ product }) {
  const soldOut = !product.in_stock

  return (
    <Link
      to={`/product/${product.id}`}
      className="group flex flex-col border-[3px] border-ink bg-paper shadow-pixel transition-transform duration-100 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-pixel-lg"
    >
      <div className="relative border-b-[3px] border-ink">
        <PixelImage
          src={product.thumbnail}
          alt={product.title}
          seed={product.id}
          className="aspect-[4/3] w-full"
        />
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          <Tag color="bg-retro-yellow">{product.category_label}</Tag>
          {product.supplier?.is_verified && (
            <Tag color="bg-retro-green">✔ Verified</Tag>
          )}
        </div>
        <div className="absolute bottom-2 right-2">
          <Tag color="bg-ink text-paper">{product.gsm} GSM</Tag>
        </div>
        {soldOut && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70">
            <span className="border-[3px] border-paper bg-retro-red px-3 py-2 font-pixel text-[10px] uppercase text-paper">
              Sold Out
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-[2.6rem] text-sm font-bold leading-snug group-hover:text-retro-red">
          {product.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-slate/70">
          {product.fabric_composition}
        </p>

        <div className="mt-3 flex items-end justify-between gap-2 border-t-2 border-dashed border-ink/30 pt-3">
          <div>
            <p className="font-pixel text-[8px] uppercase text-slate">Unit</p>
            <p className="font-term text-2xl leading-none text-retro-red">
              {bdt(product.unit_price_bdt)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-pixel text-[8px] uppercase text-slate">MOQ</p>
            <p className="font-term text-2xl leading-none">{Number(product.moq)}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-slate/80" title={product.supplier?.business_name}>
            {product.supplier?.business_name}
          </span>
          <span className="shrink-0 font-medium text-retro-navy">
            {pcs(product.available_quantity)}
          </span>
        </div>
      </div>
    </Link>
  )
}
