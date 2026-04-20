import { useState, useEffect } from 'react'
import { getPosts, getProducts } from '../services/api'
import { Image, ShoppingBag, CheckCircle, Clock, TrendingUp } from 'lucide-react'

function StatCard({ label, value, icon, color }) {
  const IconComponent = icon
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <IconComponent size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, posted: 0, scheduled: 0, draft: 0, products: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [postsRes, productsRes] = await Promise.all([
          getPosts({ limit: 5 }),
          getProducts({ limit: 1 }),
        ])
        const posts = postsRes.data.data
        const meta = postsRes.data.meta
        const productTotal = productsRes.data.meta.total

        const [postedRes, scheduledRes, draftRes] = await Promise.all([
          getPosts({ status: 'POSTED', limit: 1 }),
          getPosts({ status: 'SCHEDULED', limit: 1 }),
          getPosts({ status: 'DRAFT', limit: 1 }),
        ])

        setStats({
          total: meta.total,
          posted: postedRes.data.meta.total,
          scheduled: scheduledRes.data.meta.total,
          draft: draftRes.data.meta.total,
          products: productTotal,
        })
        setRecent(posts)
      } catch (e) {
        console.error('Dashboard load error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const statCards = [
    { label: 'Total Posts', value: stats.total, icon: Image, color: 'bg-indigo-500' },
    { label: 'Published', value: stats.posted, icon: CheckCircle, color: 'bg-green-500' },
    { label: 'Scheduled', value: stats.scheduled, icon: Clock, color: 'bg-yellow-500' },
    { label: 'Products (Unified)', value: stats.products, icon: ShoppingBag, color: 'bg-blue-500' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <p className="text-gray-500 mt-1">Your Instagram content-to-commerce overview</p>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((s) => <StatCard key={s.label} {...s} />)}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <TrendingUp size={18} className="text-indigo-500" />
              <h3 className="font-semibold text-gray-700">Recent Posts</h3>
            </div>
            {recent.length === 0 ? (
              <p className="px-6 py-8 text-gray-400 text-sm">No posts yet. Create your first carousel!</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-50">
                    <th className="px-6 py-3">Title</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((post) => (
                    <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-700">{post.title}</td>
                      <td className="px-6 py-3">
                        <StatusBadge status={post.status} />
                      </td>
                      <td className="px-6 py-3 text-gray-400">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = {
    DRAFT: 'bg-gray-100 text-gray-600',
    SCHEDULED: 'bg-yellow-100 text-yellow-700',
    POSTED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}
