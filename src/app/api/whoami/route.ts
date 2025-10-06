import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return NextResponse.json({ user: data.user ?? null, error: error?.message ?? null })
}
