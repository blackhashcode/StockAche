export const bdt = (value) => {
  const n = Number(value ?? 0)
  return `৳${n.toLocaleString('en-BD', { maximumFractionDigits: 2 })}`
}

export const pcs = (value) => `${Number(value ?? 0).toLocaleString('en-BD')} pcs`

export const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : ''

export const dateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

export const timeAgo = (iso) => {
  if (!iso) return ''
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  const units = [
    ['y', 31536000],
    ['mo', 2592000],
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
  ]
  for (const [label, size] of units) {
    const value = Math.floor(seconds / size)
    if (value >= 1) return `${value}${label} ago`
  }
  return 'just now'
}

/** Colour token per order status, used by badges and the tracker. */
export const statusColor = (status) =>
  ({
    placed: 'bg-retro-yellow',
    confirmed: 'bg-retro-teal',
    dispatched: 'bg-retro-blue text-paper',
    in_transit: 'bg-retro-purple text-paper',
    delivered: 'bg-retro-green',
    cancelled: 'bg-retro-red text-paper',
  })[status] || 'bg-retro-grey'

export const paymentColor = (status) =>
  ({
    paid: 'bg-retro-green',
    pending: 'bg-retro-yellow',
    due_on_delivery: 'bg-retro-orange',
    failed: 'bg-retro-red text-paper',
    refunded: 'bg-retro-grey',
  })[status] || 'bg-retro-grey'
