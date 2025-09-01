import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, username, password } = await req.json()
    const email = `${username.toLowerCase()}@flashcards.local`

    switch (action) {
      case 'signup':
        const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
          email,
          password,
          user_metadata: { username },
          email_confirm: true
        })

        if (signUpError) throw signUpError

        // Create account record
        if (signUpData.user) {
          await supabase
            .from('accounts')
            .insert({
              id: signUpData.user.id,
              username,
              password_hash: await hashPassword(password)
            })
        }

        return new Response(
          JSON.stringify({ user: signUpData.user }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'signin':
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (signInError) throw signInError

        return new Response(
          JSON.stringify({ user: signInData.user, session: signInData.session }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      default:
        throw new Error('Invalid action')
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}