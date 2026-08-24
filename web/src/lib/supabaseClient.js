import { createClient } from '@supabase/supabase-js'

const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://okncywujlzqictmkmggt.supabase.co'
const supabaseUrl = (() => {
  try {
    const url = new URL(configuredSupabaseUrl)
    const isLocalDevelopment = url.hostname === 'localhost' || url.hostname === '127.0.0.1'

    if (!isLocalDevelopment) {
      url.protocol = 'https:'
    }

    return url.toString().replace(/\/$/, '')
  } catch {
    return configuredSupabaseUrl
  }
})()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbmN5d3VqbHpxaWN0bWttZ2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMTkwMTYsImV4cCI6MjA3NzU5NTAxNn0.1oh2R2FViYsAW_29GHY5R50tWX7fijV2djrruKFFMME'

// Only create client if credentials are available
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

