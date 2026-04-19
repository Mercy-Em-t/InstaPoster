import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getPosts, schedulePost } from '../services/api'
import { Calendar, Clock } from 'lucide-react'

const STATUS_COLORS = {
  DRAFT:      'bg-gray-100 text-gray-600 border-gray-200',
  SCHEDULED:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  POSTED:     'bg-green-50 text-green-700 border-green-200',
  FAILED:     'bg-red-50 text-red-700 border-red-200',
}

export default function Scheduler() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)   // postId being rescheduled
  const [dateVal, setDateVal] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await getPosts({ limit: 100 })
      setPosts(res.data.data)
    } catch {
      toast.error('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSchedule(id) {
    if (!dateVal) return toast.error('Please pick a date/time')
    try {
      await schedulePost(id, new Date(dateVal).toISOString())
      toast.success('Post scheduled!')
      setEditing(null)
      setDateVal('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Schedule failed')
    }
  }

  const scheduled = posts.filter(p => p.status === 'SCHEDULED').sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
  const others    = posts.filter(p => p.status !== 'SCHEDULED')

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Scheduler</h2>
        <p className="text-gray-500 mt-1">View and manage scheduled Instagram posts</p>
      </div>

      {loading ? <p className="text-gray-400">Loading…</p> : (
        <div className="space-y-6">
          {/* Upcoming scheduled */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-yellow-500" />
              <h3 className="font-semibold text-gray-700">Upcoming ({scheduled.length})</h3>
            </div>
            {scheduled.length === 0 ? (
              <p className="text-sm text-gray-400 ml-6">No scheduled posts.</p>
            ) : (
              <div className="space-y-2">
                {scheduled.map(post => (
                  <ScheduleRow
                    key={post.id}
                    post={post}
                    editing={editing === post.id}
                    dateVal={dateVal}
                    onEdit={() => { setEditing(post.id); setDateVal('') }}
                    onCancel={() => setEditing(null)}
                    onDateChange={setDateVal}
                    onSave={() => handleSchedule(post.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Other posts — allow scheduling */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-indigo-500" />
              <h3 className="font-semibold text-gray-700">All Posts</h3>
            </div>
            <div className="space-y-2">
              {others.map(post => (
                <ScheduleRow
                  key={post.id}
                  post={post}
                  editing={editing === post.id}
                  dateVal={dateVal}
                  onEdit={() => { setEditing(post.id); setDateVal('') }}
                  onCancel={() => setEditing(null)}
                  onDateChange={setDateVal}
                  onSave={() => handleSchedule(post.id)}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function ScheduleRow({ post, editing, dateVal, onEdit, onCancel, onDateChange, onSave }) {
  const color = STATUS_COLORS[post.status] || STATUS_COLORS.DRAFT
  return (
    <div className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${color.split(' ')[2]}`}>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 truncate">{post.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {post.scheduledAt
            ? `Scheduled: ${new Date(post.scheduledAt).toLocaleString()}`
            : 'Not scheduled'}
        </p>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
        {post.status}
      </span>
      {post.status !== 'POSTED' && (
        editing ? (
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
              value={dateVal}
              onChange={e => onDateChange(e.target.value)}
            />
            <button onClick={onSave} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">Save</button>
            <button onClick={onCancel} className="px-3 py-1 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        ) : (
          <button onClick={onEdit} className="px-3 py-1 border border-indigo-200 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-50">
            {post.scheduledAt ? 'Reschedule' : 'Schedule'}
          </button>
        )
      )}
    </div>
  )
}
