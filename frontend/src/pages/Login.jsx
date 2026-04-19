import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { login } from '../services/api'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@local')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)

    try {
      const res = await login(email, password)
      localStorage.setItem('instaposter_token', res.data.token)
      localStorage.setItem('instaposter_user', JSON.stringify(res.data.user))
      window.dispatchEvent(new Event('auth-changed'))
      toast.success(`Welcome ${res.data.user.name}`)
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-800">InstaPoster Login</h1>
        <p className="text-sm text-gray-500 mt-1">Use your dashboard credentials to continue.</p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="block text-sm text-gray-600 mb-1">Email</span>
            <input
              type="email"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="block">
            <span className="block text-sm text-gray-600 mb-1">Password</span>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-indigo-600 text-white py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
