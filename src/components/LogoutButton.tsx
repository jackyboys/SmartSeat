'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      // 直接跳转到首页
      router.push('/')
      // 强制刷新页面以确保清除所有状态
      window.location.href = '/'
    } catch (error) {
      console.error('登出失败:', error)
      // 即使登出失败，也尝试跳转到首页
      window.location.href = '/'
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg"
    >
      登出
    </button>
  )
}