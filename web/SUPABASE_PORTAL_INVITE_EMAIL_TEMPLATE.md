# Patient Portal Invitation Email

The email shown to the client is sent by Supabase Auth, not by the Vite application. Configure it once in Supabase Dashboard:

1. Go to **Authentication** > **Email Templates**.
2. Open **Magic Link**. The current portal invitation uses a magic link so the client can securely choose a password after opening it.
3. Set the subject to: `Activate your AllMedical Client Portal account`
4. Replace the email body with the following HTML, then save it.

```html
<h2>Activate your AllMedical Client Portal account</h2>
<p>You have been invited to access the AllMedical Client Portal.</p>
<p>Select the secure link below to create your password, review and accept the portal Terms of Service and Privacy Notice, and access your account.</p>
<p><a href="{{ .ConfirmationURL }}">Activate your portal account</a></p>
<p>If you did not expect this invitation, you can safely ignore this email.</p>
<p>Questions? Call All Medical, LLC at 352-328-8308, Monday through Friday, 9:00 AM to 5:00 PM Eastern Time.</p>
```

Also add your deployed portal URL to **Authentication** > **URL Configuration** > **Redirect URLs**, for example `https://your-domain.com/portal`. Add `http://127.0.0.1:5173/portal` only for local testing.