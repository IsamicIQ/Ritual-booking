# SMS Notification Setup

This guide explains how to set up SMS notifications for new bookings using Africa's Talking.

## How It Works

When a client books a class, an SMS is automatically sent to **+254728780654** with:
- Client's name and phone number
- Class name, date, and time
- Package type and amount
- Any special requests/notes

## Setup Steps

### 1. Create Africa's Talking Account

1. Go to [Africa's Talking](https://africastalking.com/)
2. Sign up for an account
3. Create an application (use "sandbox" for testing, "production" for live)
4. Get your API credentials:
   - **Username**: Your app username (e.g., "sandbox" for testing)
   - **API Key**: Found in Settings > API Key

### 2. Add Environment Variables to Supabase

In your Supabase dashboard:

1. Go to **Settings > Edge Functions**
2. Add these secrets:

```
AFRICASTALKING_API_KEY=your_api_key_here
AFRICASTALKING_USERNAME=your_username_here
AFRICASTALKING_SENDER_ID=RitualStudio  # Optional - for custom sender ID
```

### 3. Deploy the Edge Function

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the SMS function
supabase functions deploy send-sms
```

### 4. Update SMS Service Configuration

In `sms-service.js`, update the edge function URL:

```javascript
const SMS_CONFIG = {
    edgeFunctionUrl: 'https://your-project.supabase.co/functions/v1/send-sms',
    studioPhone: '+254728780654'
};
```

## Testing

### Sandbox Mode (Free Testing)
1. Use username `sandbox` in Africa's Talking
2. Add test phone numbers in Africa's Talking sandbox
3. Messages won't be delivered but will show in the sandbox logs

### Production Mode
1. Create a production app in Africa's Talking
2. Buy SMS credits (very affordable - about KES 0.80 per SMS)
3. Update credentials with production values

## SMS Message Format

Each booking notification includes:

```
NEW BOOKING - Ritual Studio

Client: John Doe
Phone: 0712345678

Class: Hot Pilates
Date: Mon, 15 Jan 2024
Time: 9:00 AM
Package: single
Amount: KES 2,500

Notes: First time, has lower back issues
```

## Changing Notification Number

To change the phone number that receives notifications, edit `sms-service.js`:

```javascript
const SMS_CONFIG = {
    edgeFunctionUrl: '...',
    studioPhone: '+254XXXXXXXXX'  // Change this number
};
```

## Costs

Africa's Talking SMS rates for Kenya:
- ~KES 0.80 per SMS (about $0.006 USD)
- Very affordable for booking notifications
- Buy credits as needed, no monthly fees

## Troubleshooting

**SMS not sending?**
1. Check browser console for errors
2. Verify edge function URL is correct
3. Check Supabase Edge Function logs
4. Verify Africa's Talking API key is valid

**Wrong phone format?**
- Use international format: +254XXXXXXXXX
- The service automatically adds + if missing
