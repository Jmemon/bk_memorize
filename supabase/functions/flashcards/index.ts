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
    const authHeader = req.headers.get('authorization')
    if (!authHeader) throw new Error('No authorization header')

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw new Error('Invalid token')

    const { action, ...params } = await req.json()

    switch (action) {
      case 'getFlashcards':
        const { data: cards, error: cardsError } = await supabase
          .from('flashcards')
          .select(`
            *,
            flashcard_sets!inner(id, set_id)
          `)
          .order('card_index')

        if (cardsError) throw cardsError

        const flashcardData = { chain: [], chapters: [] }
        cards?.forEach(card => {
          const setId = card.flashcard_sets.set_id
          if (flashcardData[setId]) {
            flashcardData[setId].push({
              front: card.front,
              back: card.back,
              index: card.card_index
            })
          }
        })

        return new Response(
          JSON.stringify(flashcardData),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'getUserProgress':
        const { data: progress, error: progressError } = await supabase
          .from('user_progress')
          .select(`
            *,
            flashcards!inner(card_index),
            flashcard_sets!inner(set_id)
          `)
          .eq('user_id', user.id)

        if (progressError) throw progressError

        const formattedProgress = {}
        progress?.forEach(p => {
          const setId = p.flashcard_sets.set_id
          if (!formattedProgress[setId]) {
            formattedProgress[setId] = { correct: [], seen: [] }
          }
          const cardIndex = p.flashcards.card_index
          formattedProgress[setId].seen.push(cardIndex)
          if (p.is_correct) {
            formattedProgress[setId].correct.push(cardIndex)
          }
        })

        return new Response(
          JSON.stringify(formattedProgress),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'saveProgress':
        const { setId, stats } = params
        
        // Get set UUID
        const { data: sets, error: setError } = await supabase
          .from('flashcard_sets')
          .select('id')
          .eq('set_id', setId)
          .single()

        if (setError || !sets) throw new Error(`Set ${setId} not found`)

        // Get flashcards for this set
        const { data: flashcards, error: cardsError } = await supabase
          .from('flashcards')
          .select('id, card_index')
          .eq('set_id', sets.id)

        if (cardsError) throw cardsError

        // Update progress for each card
        for (const card of flashcards) {
          const cardIndex = card.card_index
          const isCorrect = stats.correct.includes(cardIndex)
          const wasSeen = stats.seen.includes(cardIndex)

          if (wasSeen) {
            await supabase
              .from('user_progress')
              .upsert({
                user_id: user.id,
                set_id: sets.id,
                card_id: card.id,
                is_correct: isCorrect,
                times_seen: 1, // Simplified for now
                times_correct: isCorrect ? 1 : 0,
                last_seen: new Date().toISOString()
              }, {
                onConflict: 'user_id,card_id'
              })
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
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