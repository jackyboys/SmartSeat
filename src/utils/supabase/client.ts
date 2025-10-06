import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // 使用我们之前在 .env.local 文件里设置好的环境变量
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}