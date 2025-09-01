import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { question, correctAnswer, userAnswer } = await req.json()

    // Validate input
    if (!question || !correctAnswer || !userAnswer) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: `You are evaluating a flashcard answer. Be somewhat generous in your grading - if the user demonstrates understanding of the core concept, mark it correct even if wording differs.

Question: ${question}
Correct Answer: ${correctAnswer}
User's Answer: ${userAnswer}

Evaluate if the user's answer is correct, partially correct, or incorrect.

Respond with ONLY a JSON object in this exact format:
{
    "result": "correct" or "partial" or "incorrect",
    "feedback": "Brief encouraging feedback explaining why"
}

DO NOT include any text outside the JSON object.`
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`)
    }

    const data = await response.json()
    const responseText = data.content[0].text

    // Parse the JSON response
    let assessment
    try {
      // Remove any potential markdown formatting
      const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      assessment = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText)
      // Fallback to simple comparison
      assessment = simpleAssessment(userAnswer, correctAnswer)
    }

    return new Response(
      JSON.stringify(assessment),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    
    // Fallback to simple assessment if Claude API fails
    const { userAnswer, correctAnswer } = await req.json().catch(() => ({}))
    if (userAnswer && correctAnswer) {
      const fallbackAssessment = simpleAssessment(userAnswer, correctAnswer)
      return new Response(
        JSON.stringify(fallbackAssessment),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        result: 'incorrect',
        feedback: 'Unable to process answer at this time'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function simpleAssessment(userAnswer: string, correctAnswer: string) {
  const userLower = userAnswer.toLowerCase()
  const correctLower = correctAnswer.toLowerCase()
  
  if (userLower === correctLower || correctLower.includes(userLower) || userLower.includes(correctLower)) {
    return {
      result: "correct",
      feedback: "Correct! Well done!"
    }
  } else if (userLower.split(' ').some(word => correctLower.includes(word) && word.length > 3)) {
    return {
      result: "partial",
      feedback: "Partially correct. The full answer is: " + correctAnswer
    }
  } else {
    return {
      result: "incorrect",
      feedback: "Not quite. The correct answer is: " + correctAnswer
    }
  }
}