import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getPayments, retryPayment } from '../services/api'
import { RotateCcw, Wallet } from 'lucide-react'

const STATUS_COLORS = {
  SUCCESS: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
  TIMEOUT: 'bg-orange-100 text-orange-700',
}

export default function PaymentsMonitor() {
  const [payments, setPayments] = useState([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPayments({ status: status || undefined, limit: 50 })
      setPayments(res.data.data)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  async function handleRetry(payment) {
    setRetrying((prev) => ({ ...prev, [payment.id]: true }))
    try {
      await retryPayment(payment.id, 0)
      toast.success('Retry queued')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Retry failed')
    } finally {
      setRetrying((prev) => ({ ...prev, [payment.id]: false }))
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Payments Monitor</h2>
          <p className="text-gray-500 mt-1">STK status, failed/pending tracking, and one-click retry.</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
          <option value="TIMEOUT">Timeout</option>
          <option value="SUCCESS">Success</option>
        </select>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <p className="px-6 py-8 text-gray-400">Loading…</p>
        ) : payments.length === 0 ? (
          <div className="px-6 py-10 text-gray-400 flex items-center gap-2">
            <Wallet size={18} /> No payments found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-50">
                <th className="px-6 py-3">Payment ID</th>
                <th className="px-6 py-3">Order ID</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">STK Status</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const canRetry = payment.status === 'FAILED' || payment.status === 'TIMEOUT'
                return (
                  <tr key={payment.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3 font-mono text-xs text-gray-700">{payment.id}</td>
                    <td className="px-6 py-3 text-gray-600">{payment.externalOrderId || '—'}</td>
                    <td className="px-6 py-3 text-gray-600">{payment.phone}</td>
                    <td className="px-6 py-3 text-gray-700">KES {Number(payment.amount).toLocaleString()}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[payment.status] || 'bg-gray-100 text-gray-600'}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{payment.mpesaTransaction?.status || '—'}</td>
                    <td className="px-6 py-3">
                      <button
                        disabled={!canRetry || retrying[payment.id]}
                        onClick={() => handleRetry(payment)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-50"
                      >
                        <RotateCcw size={13} />
                        {retrying[payment.id] ? 'Queueing…' : 'Retry'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
