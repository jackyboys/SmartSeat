'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

// Google SVG 图标组件
const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-3" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
        <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.3 512 0 401.7 0 265.4 0 129.2 110.3 20 244 20c66.3 0 121.3 24.4 166.3 68.6l-67.4 66C298.7 134.4 272.4 124.3 244 124.3c-74.9 0-134.8 60.5-134.8 135.2 0 74.7 59.9 135.1 134.8 135.1 82.2 0 115.3-53.7 119.5-81.8H244v-83.6h244c2.5 13.5 3.9 28.5 3.9 44.1z"></path>
    </svg>
);

export default function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const supabase = createClient()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    if (isSignUp) {
      // 处理注册
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMessage('注册成功！请检查您的邮箱以完成验证。')
      }
    } else {
      // 处理登录
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      }
      // 成功登录后，页面将通过路由逻辑自动跳转到 /dashboard
    }
    setLoading(false)
  }

  const handleOAuthLogin = async (provider: 'google') => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    })
    setLoading(false)
  }

  return (
    <div className="w-full max-w-sm p-8 space-y-6 bg-gray-800 rounded-lg">
      <h2 className="text-2xl font-bold text-center text-white">
        {isSignUp ? '注册新账号' : '登录 SmartSeat'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium text-gray-300">邮箱地址</label>
          <input
            id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium text-gray-300">密码</label>
          <input
            id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
            className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>
        <button type="submit" disabled={loading} className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-500">
          {loading ? '处理中...' : (isSignUp ? '注册' : '登录')}
        </button>
      </form>

      {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
      {message && <p className="mt-4 text-center text-sm text-green-400">{message}</p>}

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600" /></div>
        <div className="relative flex justify-center text-sm"><span className="px-2 bg-gray-800 text-gray-400">或其他方式</span></div>
      </div>

      <div>
        <button onClick={() => handleOAuthLogin('google')} disabled={loading} className="w-full flex items-center justify-center px-4 py-2 font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 disabled:bg-gray-500">
            <GoogleIcon />
            使用 Google 登录
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-gray-400">
        {isSignUp ? '已有账号？' : '没有账号？'}
        <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }} className="font-medium text-blue-400 hover:underline ml-1">
          {isSignUp ? '立即登录' : '立即注册'}
        </button>
      </p>
    </div>
  )
}
