# AllMedical Mobile - Quick Start

## Installation Steps

1. **Navigate to mobile folder:**
   ```bash
   cd mobile
   ```

2. **Install dependencies (already done):**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the mobile folder:
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` and add your Supabase credentials:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key_here
   ```
   
   ⚠️ **Important:** Use the same credentials as your web app!

4. **Start the development server:**
   ```bash
   npm start
   ```
   
   This will open Metro bundler and show a QR code.

6. **Run on your device:**
   - **Option A:** Install "Expo Go" app on your phone
     - iOS: https://apps.apple.com/app/expo-go/id982107779
     - Android: https://play.google.com/store/apps/details?id=host.exp.exponent
     - Scan the QR code from the terminal
   
   - **Option B:** Use emulator/simulator
     - Press `a` for Android emulator
     - Press `i` for iOS simulator (Mac only)

## First Time Login

Use the same admin credentials as your web dashboard.

## Features

✅ View all leads with highlighted phone numbers  
✅ Tap phone number to call directly  
✅ Pull down to refresh leads list  
✅ Tap any lead to view full details  
✅ Edit lead information inline  
✅ All changes sync with web dashboard via Supabase  

## Troubleshooting

**Issue:** "Cannot find module" errors  
**Fix:** Run `npm install` again

**Issue:** Supabase connection error  
**Fix:** Verify `.env` file has correct credentials

**Issue:** Metro bundler cache issues  
**Fix:** Run `expo start -c` (starts with cache cleared)

## Next Steps

After confirming the app works:
- Customize the app icon (assets/icon.png)
- Update app name in app.json
- Configure push notifications (optional)
- Set up EAS Build for production releases
