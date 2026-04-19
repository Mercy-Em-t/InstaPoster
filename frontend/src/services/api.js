import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Posts
export const getPosts = (params) => api.get('/posts', { params })
export const createPost = (data) => api.post('/posts', data)
export const getPost = (id) => api.get(`/posts/${id}`)
export const updatePost = (id, data) => api.patch(`/posts/${id}`, data)
export const deletePost = (id) => api.delete(`/posts/${id}`)
export const publishPost = (id) => api.post(`/posts/${id}/publish`)
export const schedulePost = (id, scheduledAt) => api.post(`/posts/${id}/schedule`, { scheduledAt })

// Products (read-only from unified view)
export const getProducts = (params) => api.get('/products', { params })
export const getProduct = (id, source) => api.get(`/products/${id}`, { params: { source } })

// Payments
export const initiateSTKPush = (data) => api.post('/payments/stk-push', data)
export const getPayments = (params) => api.get('/payments', { params })
export const getPayment = (id) => api.get(`/payments/${id}`)
export const retryPayment = (id, attempt = 0) => api.post(`/payments/${id}/retry`, { attempt })

// Orders dashboard
export const getOrders = (params) => api.get('/orders', { params })

// Analytics
export const getPostAnalytics = () => api.get('/analytics/posts')

export default api
