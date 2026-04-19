import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getPosts, createPost, publishPost, deletePost } from '../services/api'
import { Plus, Send, Trash2, RefreshCw } from 'lucide-react'

const STATUS_COLORS = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SCHEDULED: 'bg-yellow-100 text-yellow-700',
  POSTED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
}

export default function ContentManager() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '',
    caption: '',
    imageUrls: '',  // comma-separated public URLs
    scheduledAt: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function loadPosts() {
    setLoading(true)
    try {
      const res = await getPosts({ limit: 50 })
      setPosts(res.data.data)
    } catch {
      toast.error('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPosts() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.title || !form.caption) return toast.error('Title and caption are required')
    const urls = form.imageUrls.split(',').map(u => u.trim()).filter(Boolean)
    setSubmitting(true)
    try {
      await createPost({
        title: form.title,
        caption: form.caption,
        imageUrls: JSON.stringify(urls),
        ...(form.scheduledAt && { scheduledAt: form.scheduledAt }),
      })
      toast.success('Post created!')
      setForm({ title: '', caption: '', imageUrls: '', scheduledAt: '' })
      setShowForm(false)
      loadPosts()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create post')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePublish(id) {
    try {
      await publishPost(id)
      toast.success('Published to Instagram!')
      loadPosts()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Publish failed')
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this post?')) return
    try {
      await deletePost(id)
      toast.success('Post deleted')
      loadPosts()
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Content Manager</h2>
          <p className="text-gray-500 mt-1">Create and manage your Instagram carousels</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadPosts}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <Plus size={16} />
            New Post
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">New Carousel Post</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Title</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="e.g. Home Upgrade Carousel"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Caption</label>
              <textarea
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Your Instagram caption..."
                value={form.caption}
                onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Image URLs <span className="text-gray-400 font-normal">(comma-separated, must be public)</span>
              </label>
              <textarea
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="https://cdn.example.com/img1.jpg, https://cdn.example.com/img2.jpg"
                value={form.imageUrls}
                onChange={e => setForm(f => ({ ...f, imageUrls: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Schedule At <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="datetime-local"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={form.scheduledAt}
                onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create Post'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Image size={40} className="mx-auto mb-3 opacity-30" />
          <p>No posts yet. Click <strong>New Post</strong> to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {posts.map(post => (
            <div key={post.id} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-800 truncate">{post.title}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[post.status] || 'bg-gray-100 text-gray-600'}`}>
                    {post.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2">{post.caption}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {post.slides?.length || 0} slide(s) · Created {new Date(post.createdAt).toLocaleString()}
                  {post.scheduledAt && ` · Scheduled for ${new Date(post.scheduledAt).toLocaleString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {post.status !== 'POSTED' && (
                  <button
                    onClick={() => handlePublish(post.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600"
                  >
                    <Send size={13} /> Publish
                  </button>
                )}
                <button
                  onClick={() => handleDelete(post.id)}
                  className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
