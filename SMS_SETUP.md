# SMS and Patient Conversations Setup Guide

The website can send SMS notifications from the contact form and keep an inbound/outbound text conversation on each patient's admin record.

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

Set these as server-only environment variables in the `web/.env` file for local development, and as application settings for the deployed Azure Static Web App:

```
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WEBHOOK_BASE_URL=https://your-public-site.example
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
VITE_YOUR_PHONE_NUMBER=+1234567890
```

Replace:
- `your_account_sid_here` with your actual Account SID
- `your_auth_token_here` with your actual Auth Token  
- `TWILIO_PHONE_NUMBER` with your Twilio number in E.164 format
- `TWILIO_WEBHOOK_BASE_URL` with the public website origin (no trailing slash)
- `SUPABASE_SERVICE_ROLE_KEY` with the Supabase service-role key; store it only in server settings and never expose it in browser/Vite variables
- `VITE_YOUR_PHONE_NUMBER` with the cell number for contact-form notifications

The Supabase admin database needs the `SUPABASE_SERVICE_ROLE_KEY` and app URL already configured. Apply `web/add-patient-sms-messaging.sql` once in the Supabase SQL Editor to create the private message table and phone matching function.

In the Twilio Console, set the messaging webhook for the Twilio phone number to:

```
https://your-public-site.example/api/twilio-webhook
```

Use **HTTP POST** for incoming messages. Outbound delivery-status callbacks use this same endpoint automatically. The webhook validates Twilio request signatures.

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

## Patient conversations

After applying the SQL and setting the server environment variables, open a patient in the admin dashboard and select **Messages**. Incoming texts from a phone number matching exactly one patient are added to that patient's conversation; unmatched or ambiguous numbers are stored without a patient link and reported in the server logs.

Before sending patient information by SMS, confirm your Twilio account, Supabase project, hosting configuration, retention policies, access controls, and patient consent meet your organization's HIPAA and other applicable requirements. This feature alone does not make an environment HIPAA-compliant; avoid sending sensitive clinical details in ordinary SMS.
