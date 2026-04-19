import { useState, useEffect } from 'react'
import { getPosts } from '../services/api'
import { BarChart2, MousePointerClick, ShoppingCart, TrendingUp } from 'lucide-react'

export default function Analytics() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPosts({ limit: 50, status: 'POSTED' })
      .then(res => setPosts(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const totalPosts = posts.length
  const withLinks = posts.filter(p => p.trackingLinks?.length > 0).length

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
        <p className="text-gray-500 mt-1">Track which posts drive traffic and conversions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MiniStat label="Published Posts" value={totalPosts} icon={BarChart2} />
        <MiniStat label="Posts with Tracking" value={withLinks} icon={MousePointerClick} />
        <MiniStat label="Conversion Tracking" value="Via webhook" icon={ShoppingCart} />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
          <TrendingUp size={18} className="text-indigo-500" />
          <h3 className="font-semibold text-gray-700">Published Posts Performance</h3>
        </div>

        {loading ? (
          <p className="px-6 py-8 text-gray-400 text-sm">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="px-6 py-8 text-gray-400 text-sm">No published posts yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-50">
                <th className="px-6 py-3">Post Title</th>
                <th className="px-6 py-3">Published At</th>
                <th className="px-6 py-3">Tracking Links</th>
                <th className="px-6 py-3">IG Post ID</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-700">{post.title}</td>
                  <td className="px-6 py-3 text-gray-500">
                    {post.postedAt ? new Date(post.postedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-6 py-3">
                    {post.trackingLinks?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {post.trackingLinks.map(l => (
                          <code key={l.id} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                            {l.code}
                          </code>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-400 font-mono text-xs">
                    {post.instagramPostId || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-xl p-5 text-sm text-indigo-700">
        <strong>💡 Tip:</strong> Hourly analytics aggregation runs automatically via the BullMQ worker.
        Real-time click counts and conversion rates are logged server-side and can be connected to
        a monitoring dashboard (Grafana, Mixpanel, etc.).
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
