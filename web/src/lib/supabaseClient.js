import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://okncywujlzqictmkmggt.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbmN5d3VqbHpxaWN0bWttZ2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMTkwMTYsImV4cCI6MjA3NzU5NTAxNn0.1oh2R2FViYsAW_29GHY5R50tWX7fijV2djrruKFFMME'

// Only create client if credentials are available
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

