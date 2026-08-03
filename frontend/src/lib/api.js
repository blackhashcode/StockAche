/**
 * Thin fetch wrapper around the Django API.
 *
 * The access token is injected by AuthContext via `setTokenGetter` so this
 * module never has to import React state.
 */

const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'
).replace(/\/$/, '')

let tokenGetter = async () => null

export function setTokenGetter(fn) {
  tokenGetter = fn
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }

  /** Flatten DRF's {field: [msg]} shape into one readable line. */
  get fieldMessages() {
    if (!this.payload || typeof this.payload !== 'object') return []
    return Object.entries(this.payload).flatMap(([field, value]) => {
      const messages = Array.isArray(value) ? value : [value]
      return messages.map((m) => (field === 'detail' ? String(m) : `${field}: ${m}`))
    })
  }
}

async function request(path, { method = 'GET', body, isForm = false, auth = true } = {}) {
  const headers = {}
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = await tokenGetter()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    throw new ApiError(
      'Cannot reach the StockAche server. Is the Django backend running on port 8000?',
      0,
      null,
    )
  }

  if (response.status === 204) return null

  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }

  if (!response.ok) {
    const error = new ApiError(
      typeof payload === 'object' && payload?.detail
        ? payload.detail
        : `Request failed (${response.status})`,
      response.status,
      payload,
    )
    throw error
  }
  return payload
}

const qs = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.append(key, value)
  })
  const str = search.toString()
  return str ? `?${str}` : ''
}

export const api = {
  meta: () => request('/meta/', { auth: false }),

  // --- auth / profile ---
  me: () => request('/auth/me/'),
  selectRole: (role) => request('/auth/role/', { method: 'POST', body: { role } }),
  devLogin: (email) =>
    request('/auth/dev-login/', { method: 'POST', body: { email }, auth: false }),

  getBuyerProfile: () => request('/profiles/buyer/'),
  saveBuyerProfile: (data) => request('/profiles/buyer/', { method: 'PUT', body: data }),
  getSupplierProfile: () => request('/profiles/supplier/'),
  saveSupplierProfile: (data) =>
    request('/profiles/supplier/', { method: 'PUT', body: data }),
  supplierPublic: (id) => request(`/suppliers/${id}/`, { auth: false }),

  // --- marketplace ---
  products: (params) => request(`/products/${qs(params)}`, { auth: false }),
  product: (id) => request(`/products/${id}/`, { auth: false }),
  quote: (id, quantity, deliverySpeed = 'standard') =>
    request(`/products/${id}/quote/`, {
      method: 'POST',
      body: { quantity, delivery_speed: deliverySpeed },
      auth: false,
    }),

  // --- supplier inventory ---
  myProducts: () => request('/products/mine/'),
  createProduct: (data) => request('/products/', { method: 'POST', body: data }),
  updateProduct: (id, data) => request(`/products/${id}/`, { method: 'PATCH', body: data }),
  deleteProduct: (id) => request(`/products/${id}/`, { method: 'DELETE' }),

  // --- orders ---
  orders: (params) => request(`/orders/${qs(params)}`),
  order: (id) => request(`/orders/${id}/`),
  placeOrder: (data) => request('/orders/', { method: 'POST', body: data }),
  incomingOrders: (params) => request(`/orders/incoming/${qs(params)}`),
  updateOrderStatus: (id, status, note = '') =>
    request(`/orders/${id}/status/`, { method: 'POST', body: { status, note } }),
  cancelOrder: (id, reason = '') =>
    request(`/orders/${id}/cancel/`, { method: 'POST', body: { reason } }),
  reviewOrder: (id, rating, review) =>
    request(`/orders/${id}/review/`, { method: 'POST', body: { rating, review } }),

  // --- cancellation requests ---
  requestCancellation: (id, reason) =>
    request(`/orders/${id}/cancellation-request/`, { method: 'POST', body: { reason } }),
  withdrawCancellation: (id) =>
    request(`/orders/${id}/cancellation-request/withdraw/`, { method: 'POST' }),
  resolveCancellation: (id, approve, note = '') =>
    request(`/orders/${id}/cancellation-request/resolve/`, {
      method: 'POST',
      body: { approve, note },
    }),
  cancellationQueue: (params) => request(`/orders/cancellation-requests/${qs(params)}`),

  // --- dashboards ---
  supplierDashboard: () => request('/dashboard/supplier/'),
  supplierEarnings: () => request('/dashboard/supplier/earnings/'),
  buyerDashboard: () => request('/dashboard/buyer/'),

  // --- uploads ---
  upload: (file, folder = 'listings') => {
    const form = new FormData()
    form.append('file', file)
    form.append('folder', folder)
    return request('/uploads/', { method: 'POST', body: form, isForm: true })
  },
}
