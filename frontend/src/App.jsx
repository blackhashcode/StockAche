import { Route, Routes } from 'react-router-dom'

import { RequireAuth, RequireRole } from './components/Guards'
import Layout from './components/Layout'
import AuthCallback from './pages/AuthCallback'
import BuyerOrders from './pages/BuyerOrders'
import Checkout from './pages/Checkout'
import Landing from './pages/Landing'
import ListingForm from './pages/ListingForm'
import Login from './pages/Login'
import Marketplace from './pages/Marketplace'
import NotFound from './pages/NotFound'
import Onboarding from './pages/Onboarding'
import OrderDetail from './pages/OrderDetail'
import ProductDetail from './pages/ProductDetail'
import ProfilePage from './pages/ProfilePage'
import SupplierDashboard from './pages/SupplierDashboard'
import SupplierListings from './pages/SupplierListings'
import SupplierOrders from './pages/SupplierOrders'
import SupplierPublic from './pages/SupplierPublic'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/supplier/:id" element={<SupplierPublic />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Signed in, role not yet finalised */}
        <Route
          path="/onboarding"
          element={
            <RequireAuth requireOnboarding={false}>
              <Onboarding />
            </RequireAuth>
          }
        />

        {/* Buyer */}
        <Route
          path="/checkout/:productId"
          element={
            <RequireRole role="buyer">
              <Checkout />
            </RequireRole>
          }
        />
        <Route
          path="/orders"
          element={
            <RequireRole role="buyer">
              <BuyerOrders />
            </RequireRole>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <RequireAuth>
              <OrderDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/buyer/profile"
          element={
            <RequireRole role="buyer">
              <ProfilePage kind="buyer" />
            </RequireRole>
          }
        />

        {/* Supplier — note these sit above /supplier/:id in match order */}
        <Route
          path="/supplier"
          element={
            <RequireRole role="supplier">
              <SupplierDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/supplier/listings"
          element={
            <RequireRole role="supplier">
              <SupplierListings />
            </RequireRole>
          }
        />
        <Route
          path="/supplier/listings/new"
          element={
            <RequireRole role="supplier">
              <ListingForm />
            </RequireRole>
          }
        />
        <Route
          path="/supplier/listings/:id/edit"
          element={
            <RequireRole role="supplier">
              <ListingForm />
            </RequireRole>
          }
        />
        <Route
          path="/supplier/orders"
          element={
            <RequireRole role="supplier">
              <SupplierOrders />
            </RequireRole>
          }
        />
        <Route
          path="/supplier/profile"
          element={
            <RequireRole role="supplier">
              <ProfilePage kind="supplier" />
            </RequireRole>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
