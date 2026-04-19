import { useState, useEffect, useCallback } from 'react'
import { getProducts } from '../services/api'
import { Search, RefreshCw, Package } from 'lucide-react'

export default function Products() {
  const [products, setProducts] = useState([])
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 })
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getProducts({ search, source: source || undefined, page, limit: 20 })
      setProducts(res.data.data)
      setMeta(res.data.meta)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load products. Is the unified view configured?')
    } finally {
      setLoading(false)
    }
  }, [search, source, page])

  useEffect(() => { load() }, [load])

  function handleSearch(e) {
    e.preventDefault()
    setPage(1)
    load()
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Products</h2>
        <p className="text-gray-500 mt-1">
          Read-only view from <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">unified_products</code> — your existing shop data, no duplication.
        </p>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white flex-1 min-w-48">
          <Search size={15} className="text-gray-400" />
          <input
            className="flex-1 outline-none text-sm"
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
          value={source}
          onChange={e => { setSource(e.target.value); setPage(1) }}
        >
          <option value="">All sources</option>
          <option value="main_store">Main Store</option>
          <option value="secondary_store">Secondary Store</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          Search
        </button>
        <button
          type="button"
          onClick={load}
          className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
        >
          <RefreshCw size={16} />
        </button>
      </form>

      {loading ? (
        <p className="text-gray-400">Loading products…</p>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
          <strong>Error:</strong> {error}
          <p className="mt-1 text-xs text-red-500">Ensure the <code>unified_products</code> SQL view is created in your PostgreSQL instance.</p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p>No products found.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">{meta.total} product(s) found</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map(product => (
              <ProductCard key={`${product.source}-${product.product_id}`} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {meta.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {meta.pages}</span>
              <button
                disabled={page === meta.pages}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ProductCard({ product }) {
  const stockColor = product.stock_quantity > 10
    ? 'text-green-600'
    : product.stock_quantity > 0
    ? 'text-yellow-600'
    : 'text-red-600'

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-40 object-cover bg-gray-100"
          onError={e => { e.target.style.display = 'none' }}
        />
      ) : (
        <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
          <Package size={32} className="text-gray-300" />
        </div>
      )}
      <div className="p-4">
        <p className="font-semibold text-gray-800 text-sm truncate">{product.name}</p>
        <p className="text-indigo-600 font-bold text-sm mt-1">
          KES {Number(product.price).toLocaleString()}
        </p>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs font-medium ${stockColor}`}>
            {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}
          </span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            {product.source}
          </span>
        </div>
      </div>
    </div>
  )
}
