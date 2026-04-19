import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { LayoutDashboard, Image, Calendar, ShoppingBag, BarChart2, ReceiptText, Wallet } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import ContentManager from './pages/ContentManager'
import Scheduler from './pages/Scheduler'
import Products from './pages/Products'
import Analytics from './pages/Analytics'
import OrdersDashboard from './pages/OrdersDashboard'
import PaymentsMonitor from './pages/PaymentsMonitor'

const navItems = [
  { to: '/',          label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/content',  label: 'Content',      icon: Image },
  { to: '/schedule', label: 'Scheduler',    icon: Calendar },
  { to: '/products', label: 'Products',     icon: ShoppingBag },
  { to: '/orders',   label: 'Orders',       icon: ReceiptText },
  { to: '/payments', label: 'Payments',     icon: Wallet },
  { to: '/analytics',label: 'Analytics',    icon: BarChart2 },
]

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
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
          <div className="px-5 py-4 border-t border-gray-100 text-xs text-gray-400">
            v1.0.0
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/content"   element={<ContentManager />} />
            <Route path="/schedule"  element={<Scheduler />} />
            <Route path="/products"  element={<Products />} />
            <Route path="/orders"    element={<OrdersDashboard />} />
            <Route path="/payments"  element={<PaymentsMonitor />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
