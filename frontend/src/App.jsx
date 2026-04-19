import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { LayoutDashboard, Image, Calendar, ShoppingBag, BarChart2, ReceiptText, Wallet } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import ContentManager from './pages/ContentManager'
import Scheduler from './pages/Scheduler'
import Products from './pages/Products'
import Analytics from './pages/Analytics'
import OrdersDashboard from './pages/OrdersDashboard'
import PaymentsMonitor from './pages/PaymentsMonitor'
import Login from './pages/Login'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(localStorage.getItem('instaposter_token')))
  const [currentRole, setCurrentRole] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('instaposter_user') || '{}').role || null
    } catch {
      return null
    }
  })

  useEffect(() => {
    function onStorageChange() {
      const token = localStorage.getItem('instaposter_token')
      setIsAuthenticated(Boolean(token))

      try {
        setCurrentRole(JSON.parse(localStorage.getItem('instaposter_user') || '{}').role || null)
      } catch {
        setCurrentRole(null)
      }
    }

    window.addEventListener('storage', onStorageChange)
    window.addEventListener('auth-changed', onStorageChange)
    onStorageChange()
    return () => {
      window.removeEventListener('storage', onStorageChange)
      window.removeEventListener('auth-changed', onStorageChange)
    }
  }, [])

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <RealtimeNotifications enabled={isAuthenticated} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={isAuthenticated ? <AppShell currentRole={currentRole} onLogout={() => {
            localStorage.removeItem('instaposter_token')
            localStorage.removeItem('instaposter_user')
            setIsAuthenticated(false)
            setCurrentRole(null)
            window.dispatchEvent(new Event('auth-changed'))
          }} /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}

function AppShell({ currentRole, onLogout }) {
  const navigate = useNavigate()

  const navItems = useMemo(() => {
    const base = [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'STAFF', 'VIEWER'] },
      { to: '/analytics', label: 'Analytics', icon: BarChart2, roles: ['ADMIN', 'STAFF', 'VIEWER'] },
    ]

    const ops = [
      { to: '/content', label: 'Content', icon: Image, roles: ['ADMIN', 'STAFF'] },
      { to: '/schedule', label: 'Scheduler', icon: Calendar, roles: ['ADMIN', 'STAFF'] },
      { to: '/products', label: 'Products', icon: ShoppingBag, roles: ['ADMIN', 'STAFF'] },
      { to: '/orders', label: 'Orders', icon: ReceiptText, roles: ['ADMIN', 'STAFF'] },
      { to: '/payments', label: 'Payments', icon: Wallet, roles: ['ADMIN', 'STAFF'] },
    ]

    return [...base, ...ops].filter((item) => item.roles.includes(currentRole || 'VIEWER'))
  }, [currentRole])

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <h1 className="text-xl font-bold text-indigo-600 tracking-tight">InstaPoster</h1>
            <p className="text-xs text-gray-400 mt-0.5">Content-Commerce Engine</p>
          </div>
          <nav className="flex-1 py-4 space-y-1 px-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="px-5 py-4 border-t border-gray-100 text-xs text-gray-500 space-y-2">
            <p>Role: <span className="font-semibold">{currentRole || 'VIEWER'}</span></p>
            <button
              type="button"
              className="text-red-500 hover:text-red-600"
              onClick={() => {
                onLogout()
                navigate('/login')
              }}
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/content"   element={<RoleRoute role={currentRole} roles={['ADMIN', 'STAFF']}><ContentManager /></RoleRoute>} />
            <Route path="/schedule"  element={<RoleRoute role={currentRole} roles={['ADMIN', 'STAFF']}><Scheduler /></RoleRoute>} />
            <Route path="/products"  element={<RoleRoute role={currentRole} roles={['ADMIN', 'STAFF']}><Products /></RoleRoute>} />
            <Route path="/orders"    element={<RoleRoute role={currentRole} roles={['ADMIN', 'STAFF']}><OrdersDashboard /></RoleRoute>} />
            <Route path="/payments"  element={<RoleRoute role={currentRole} roles={['ADMIN', 'STAFF']}><PaymentsMonitor /></RoleRoute>} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
  )
}

function RoleRoute({ role, roles, children }) {
  if (!roles.includes(role || 'VIEWER')) {
    return <Navigate to="/" replace />
  }
  return children
}

function RealtimeNotifications({ enabled }) {
  useEffect(() => {
    if (!enabled) return undefined
    const wsBase = window.location.origin.replace(/^http/, 'ws')
    const socket = new WebSocket(`${wsBase}/ws`)

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'payment:updated') {
          toast.success(`Payment ${message.payload.paymentId} → ${message.payload.status}`)
        }
        if (message.type === 'order:created') {
          toast(`New order ${message.payload.externalOrderId} bridged`, { icon: '🧾' })
        }
        if (message.type === 'post:published') {
          toast.success(`Post ${message.payload.id} published`)
        }
      } catch {
        // ignore invalid websocket payloads
      }
    }

    return () => socket.close()
  }, [enabled])

  return null
}
