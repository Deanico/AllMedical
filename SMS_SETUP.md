# SMS Notification Setup Guide

Your contact form now sends SMS notifications when someone submits it! Here's how to set it up:

## Step 1: Create a Twilio Account

1. Go to https://www.twilio.com/try-twilio
2. Sign up for a free account
3. Verify your phone number

## Step 2: Get Your Twilio Credentials

1. Log in to your Twilio Console: https://console.twilio.com/
2. Find these values on your dashboard:
   - **Account SID** (looks like: ACxxxxxxxxxxxxxxxxxxxxx)
   - **Auth Token** (click to reveal)
3. Get a phone number:
   - Go to "Phone Numbers" → "Manage" → "Buy a number"
   - Select a number (free trial gives you one)
   - Note this number (format: +1234567890)

## Step 3: Add Environment Variables

Add these to your `.env` file in the `web` folder:

```
VITE_TWILIO_ACCOUNT_SID=your_account_sid_here
VITE_TWILIO_AUTH_TOKEN=your_auth_token_here
VITE_TWILIO_PHONE_NUMBER=+1234567890
VITE_YOUR_PHONE_NUMBER=+1234567890
```

Replace:
- `your_account_sid_here` with your actual Account SID
- `your_auth_token_here` with your actual Auth Token  
- First phone number with your Twilio number
- Second phone number with YOUR cell phone (where you want to receive SMS)

## Step 4: Restart Your Development Server

```bash
cd web
npm run dev
```

## How It Works

When someone submits the contact form, you'll receive an SMS like:

```
New Contact Form Submission:
Name: John Doe
Email: john@example.com
Phone: 555-1234
Insurance: Blue Cross
Notes: Interested in Omnipod supplies
```

## Troubleshooting

- **SMS not sending?** Check that all environment variables are set correctly
- **Trial account limitations:** Twilio trial accounts can only send to verified numbers
- **Verify your phone:** In Twilio Console → Phone Numbers → Verified Caller IDs

## Going Live

When ready for production:
1. Upgrade your Twilio account (pay-as-you-go, ~$0.0075 per SMS)
2. Remove trial limitations
3. Deploy your site to Azure/Vercel/Netlify with environment variables

Your form will continue to work even if SMS fails - it won't break the user experience!
