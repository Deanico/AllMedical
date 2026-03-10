# Admin Dashboard Setup Guide

This guide walks you through setting up the admin dashboard for tracking leads and clients.

## 1. Database Setup

### Step 1: Create Supabase Tables

1. Log in to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to the **SQL Editor**
4. Copy the contents of `supabase-schema.sql` and paste it into the SQL editor
5. Click **Run** to create the `leads` table and all necessary indexes

### Step 2: Verify Table Creation

1. Go to **Table Editor** in Supabase
2. You should see a `leads` table with the following columns:
   - id (uuid)
   - name (text)
   - email (text)
   - phone (text)
   - insurance (text)
   - notes (text)
   - stage (text) - enum: new, called, reached, unqualified, qualified
   - qualified_at (timestamp)
   - product_needed (text)
   - date_shipped (date)
   - created_at (timestamp)
   - updated_at (timestamp)

## 2. Testing the Setup

### Test the Contact Form

1. Start your development server: `npm run dev`
2. Fill out the contact form on the homepage
3. Submit the form
4. Check your Supabase Table Editor to verify the lead was saved

### Access the Admin Dashboard

1. Go to `http://localhost:5173/admin` (or your deployed URL + `/admin`)
2. Log in with one of the authorized emails:
   - `dean@nideai.net`
   - `deansolarmachine@gmail.com`
3. Password: `Allmedical20!`

## 3. Using the Admin Dashboard

### Leads Tab

The Leads tab shows all non-qualified leads with the following information:
- Full Name
- Phone Number
- Email
- Insurance Provider
- Stage (dropdown)

**Managing Lead Stages:**
- Click the dropdown in the "Stage" column to update a lead's status
- Available stages:
  - **New** - Just submitted (default)
  - **Called** - You've called them
  - **Reached** - You've spoken with them
  - **Unqualified** - Not a good fit
  - **Qualified** - Ready to become a client

When you mark a lead as "Qualified", it automatically:
- Sets the `qualified_at` timestamp
- Moves the lead to the Clients tab

### Clients Tab

The Clients tab shows all qualified leads and allows detailed tracking:

**Left Panel: Client List**
- Shows all qualified clients
- Click on any client to view/edit their details

**Right Panel: Client Details**
- **Email** - Read-only
- **Phone** - Read-only
- **Insurance Provider** - Read-only
- **Date Qualified** - Automatically set when marked as qualified
- **Product Needed** - Editable text area (e.g., "MiniMed Quick-set, 3.0mL Reservoirs")
- **Date Shipped** - Date picker to track when you shipped products

**Key Feature:**
Track shipping dates so you know when to send the next shipment. For example:
- If a client uses infusion sets that need replacing every 3 days
- You shipped on March 1st
- Set a reminder to ship again around March 30th

## 4. Workflow Example

### New Lead Comes In

1. **Form Submission:**
   - Customer fills out the contact form
   - Lead appears in the Leads tab with stage "New"

2. **Initial Contact:**
   - You call the customer
   - Update stage to "Called"

3. **Qualification:**
   - If reached and qualified, set stage to "Qualified"
   - Lead automatically moves to Clients tab

4. **Client Management:**
   - Click on the client in the Clients tab
   - Add what products they need
   - When you ship products, add the shipping date
   - Use shipping dates to plan your next shipments

## 5. Security Notes

- Admin credentials are hardcoded for simplicity
- In production, consider:
  - Moving to Supabase Auth for better security
  - Adding password hashing
  - Implementing session timeout
  - Adding audit logs

## 6. Accessing Admin from Public Site

There's a hidden admin link on the public site:
- Look for a small dot (•) at the very bottom of the page below the footer
- Click it to navigate to the admin login

Alternatively, just navigate directly to `/admin` in your browser.

## 7. Troubleshooting

### Leads not saving
- Check that your `.env` file has valid Supabase credentials
- Verify the `leads` table was created in Supabase
- Check browser console for errors

### Can't log in
- Verify you're using one of the authorized emails
- Password is case-sensitive: `Allmedical20!`

### Data not updating
- Refresh the page to see latest data
- Check browser console for errors
- Verify Supabase credentials are correct

## 8. Future Enhancements (Optional)

Consider adding:
- Automatic reminders when shipping dates approach
- Email notifications for new leads
- Export leads/clients to CSV
- Lead source tracking (Meta Ads vs Website Form)
- Notes/history on each client
- Bulk actions (mark multiple as called, etc.)
- Search and filtering capabilities
