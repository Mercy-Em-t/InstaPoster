import { useEffect, useState } from 'react'
import { getPostAnalytics } from '../services/api'
import { BarChart2, MousePointerClick, ShoppingCart, TrendingUp } from 'lucide-react'

export default function Analytics() {
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({ totalPosts: 0, totalClicks: 0, totalSales: 0, overallConversionRate: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPostAnalytics()
      .then((res) => {
        setRows(res.data.data || [])
        setSummary(res.data.summary || { totalPosts: 0, totalClicks: 0, totalSales: 0, overallConversionRate: 0 })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
        <p className="text-gray-500 mt-1">Clicks per post, sales per post, and conversion rate.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <MiniStat label="Tracked Posts" value={summary.totalPosts} icon={BarChart2} />
        <MiniStat label="Total Clicks" value={summary.totalClicks} icon={MousePointerClick} />
        <MiniStat label="Total Sales" value={summary.totalSales} icon={ShoppingCart} />
        <MiniStat label="Overall Conversion" value={`${summary.overallConversionRate}%`} icon={TrendingUp} />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
          <TrendingUp size={18} className="text-indigo-500" />
          <h3 className="font-semibold text-gray-700">Per-Post Performance</h3>
        </div>

        {loading ? (
          <p className="px-6 py-8 text-gray-400 text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-6 py-8 text-gray-400 text-sm">No analytics data yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-50">
                <th className="px-6 py-3">Post</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Clicks</th>
                <th className="px-6 py-3">Sales</th>
                <th className="px-6 py-3">Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.postId} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-700">{row.title}</td>
                  <td className="px-6 py-3 text-gray-500">{row.status}</td>
                  <td className="px-6 py-3 text-gray-700">{row.clicks}</td>
                  <td className="px-6 py-3 text-gray-700">{row.sales}</td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                      {row.conversionRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function MiniStat({ label, value, icon: Icon }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center gap-4">
      <div className="p-3 bg-indigo-50 rounded-lg">
        <Icon size={20} className="text-indigo-600" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  )
}
