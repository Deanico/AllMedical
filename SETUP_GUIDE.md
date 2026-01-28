# AllMedical Landing Page Setup & Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Supabase account (free tier available)

### Installation

1. **Navigate to web directory:**
   ```bash
   cd web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Supabase:**
   - Go to [supabase.com](https://supabase.com) and create a free account
   - Create a new project
   - Copy your `Project URL` and `Anon Key` from Settings > API
   - Update `.env` file with your credentials:
     ```
     VITE_SUPABASE_URL=your_project_url
     VITE_SUPABASE_ANON_KEY=your_anon_key
     ```

4. **Create database table in Supabase:**
   - Go to SQL Editor and run:
   ```sql
   CREATE TABLE contact_submissions (
     id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
     name TEXT NOT NULL,
     email TEXT NOT NULL,
     phone TEXT,
     company TEXT,
     message TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
   ```

### Development

```bash
npm run dev
```
Visit `http://localhost:5173`

### Build for Production

```bash
npm run build
```
Output files will be in `dist/` folder

---

## 📋 Features

✅ **Professional Landing Page**
- Hero section with clear value proposition
- Services showcase (6 services)
- Benefits section with checklist
- About section with statistics
- Call-to-action footer

✅ **Floating "CHECK NOW" Button**
- Always visible on right side of screen
- Animated pulse effect
- Opens contact form modal

✅ **Contact Form Modal**
- Fields: Name, Email, Phone, Company, Message
- Form validation
- Supabase integration for data storage
- Success confirmation screen
- Error handling

✅ **Responsive Design**
- Mobile-first approach
- Works on all screen sizes
- Tailwind CSS for styling

---

## 🌐 Deployment Options

### Option 1: Vercel (Recommended for Vite)
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy

### Option 2: Netlify
1. Push code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Connect your repository
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Add environment variables
7. Deploy

### Option 3: Azure Static Web Apps
1. Create Azure account
2. Create Static Web App resource
3. Connect GitHub repository
4. Configure build settings:
   - Build location: `web`
   - Output location: `dist`
5. Add secrets for environment variables
6. Deploy

### Option 4: Docker Container
```bash
# Build
docker build -t allmedical-web .

# Run
docker run -p 3000:3000 allmedical-web
```

---

## 📱 Form Submission Flow

1. User clicks "CHECK NOW" button
2. Modal opens with contact form
3. User fills and submits form
4. Data saves to Supabase
5. Success message displays
6. Modal closes after 3 seconds

---

## 🔐 Security Notes

- Supabase RLS (Row Level Security) is enabled
- All form data is stored securely
- HTTPS is required in production
- Sensitive data should never be in client code

---

## 🎨 Customization

### Colors
Edit `web/tailwind.config.js` to change color scheme:
```javascript
colors: {
  medical: {
    600: '#your-color',
    // ...
  }
}
```

### Content
Update text in `src/App.jsx`:
- Hero headline
- Services list
- Benefits list
- About section
- Footer links

### Styling
All styles use Tailwind CSS utility classes in the JSX. No separate CSS files needed.

---

## 📧 Supabase Form Data Access

### View Submissions:
1. Go to Supabase Dashboard
2. Click "SQL Editor"
3. Run: `SELECT * FROM contact_submissions ORDER BY created_at DESC;`

### Export as CSV:
Use Supabase's built-in export feature in the Table Editor

---

## 🐛 Troubleshooting

**Form not submitting?**
- Check `.env` file has correct Supabase credentials
- Verify database table exists
- Check browser console for errors

**Styling looks broken?**
- Clear browser cache
- Run `npm install` again
- Rebuild: `npm run build`

**Build errors?**
- Delete `node_modules` and `package-lock.json`
- Run `npm install` from scratch

---

## 📞 Support

For issues or questions:
1. Check Supabase documentation: https://supabase.com/docs
2. Check Vite docs: https://vitejs.dev
3. Check Tailwind docs: https://tailwindcss.com

---

**Ready to launch your landing page! 🚀**
