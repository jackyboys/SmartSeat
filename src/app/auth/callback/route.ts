import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 这个路由的作用是处理从 Supabase 认证邮件链接返回时附带的授权码。
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    // 如果 URL 中有 code，我们就用它来换取用户的 session (会话)
    // 这个过程会自动为用户设置一个登录状态的 cookie
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // 认证流程完成后，将用户重定向回网站的首页。
  // 此时，首页的服务器组件会检测到登录 cookie，并自动将用户跳转到 /dashboard
  return NextResponse.redirect(requestUrl.origin)
}
