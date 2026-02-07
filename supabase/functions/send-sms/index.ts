// Supabase Edge Function for sending SMS via Africa's Talking
// Deploy: supabase functions deploy send-sms

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const AFRICASTALKING_API_KEY = Deno.env.get('AFRICASTALKING_API_KEY') || ''
const AFRICASTALKING_USERNAME = Deno.env.get('AFRICASTALKING_USERNAME') || ''
const AFRICASTALKING_SENDER_ID = Deno.env.get('AFRICASTALKING_SENDER_ID') || '' // Optional

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, message } = await req.json()

    if (!to || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: to, message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!AFRICASTALKING_API_KEY || !AFRICASTALKING_USERNAME) {
      console.error('Africa\'s Talking credentials not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'SMS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Format phone number (ensure it starts with +)
    const formattedPhone = to.startsWith('+') ? to : `+${to}`

    // Build form data for Africa's Talking API
    const formData = new URLSearchParams()
    formData.append('username', AFRICASTALKING_USERNAME)
    formData.append('to', formattedPhone)
    formData.append('message', message)
    if (AFRICASTALKING_SENDER_ID) {
      formData.append('from', AFRICASTALKING_SENDER_ID)
    }

    // Send SMS via Africa's Talking
    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'apiKey': AFRICASTALKING_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: formData.toString()
    })

    const result = await response.json()

    if (result.SMSMessageData?.Recipients?.[0]?.status === 'Success') {
      console.log('SMS sent successfully to', formattedPhone)
      return new Response(
        JSON.stringify({ success: true, messageId: result.SMSMessageData.Recipients[0].messageId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      console.error('SMS sending failed:', result)
      return new Response(
        JSON.stringify({ success: false, error: result.SMSMessageData?.Message || 'Unknown error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('SMS function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
