import { useEffect, useState } from 'react'
import { getOrders } from '../services/api'
import { ShoppingBag } from 'lucide-react'

const PAYMENT_COLORS = {
  SUCCESS: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
  TIMEOUT: 'bg-orange-100 text-orange-700',
  NOT_STARTED: 'bg-gray-100 text-gray-600',
}

export default function OrdersDashboard() {
  const [orders, setOrders] = useState([])
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load(page)
  }, [page])

  async function load(targetPage = 1) {
    setLoading(true)
    try {
      const res = await getOrders({ page: targetPage, limit: 20 })
      setOrders(res.data.data)
      setMeta(res.data.meta)
    } catch (err) {
      console.error('Failed to load orders', err)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Orders Dashboard</h2>
        <p className="text-gray-500 mt-1">Orders from existing system (bridge), payment status, and tracking source.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <p className="px-6 py-8 text-gray-400">Loading…</p>
        ) : orders.length === 0 ? (
          <div className="px-6 py-10 text-gray-400 flex items-center gap-2">
            <ShoppingBag size={18} /> No bridged orders yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-50">
                <th className="px-6 py-3">Order ID</th>
                <th className="px-6 py-3">Source</th>
                <th className="px-6 py-3">Payment Status</th>
                <th className="px-6 py-3">STK Status</th>
                <th className="px-6 py-3">Tracking Source (Post)</th>
                <th className="px-6 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono text-xs text-gray-700">{order.externalOrderId}</td>
                  <td className="px-6 py-3 text-gray-600">{order.sourceSystem}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_COLORS[order.paymentStatus] || PAYMENT_COLORS.NOT_STARTED}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{order.stkStatus || '—'}</td>
                  <td className="px-6 py-3">
                    {order.post ? (
                      <div className="text-gray-700">
                        <p className="font-medium">{order.post.title}</p>
                        <p className="text-xs text-gray-400">code: {order.trackingCode}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400">Unattributed</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-400">{new Date(order.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {meta.pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {meta.page} of {meta.pages}</span>
          <button
            disabled={page === meta.pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
