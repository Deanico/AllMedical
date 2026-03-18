# AllMedical Mobile

React Native mobile app for AllMedical admin portal, built with Expo and Supabase.

## Features

- 📱 View all leads with phone numbers prominent
- 📞 Quick call feature - tap phone number to dial
- ✏️ Edit lead information on the go
- 🔄 Pull to refresh
- 🔐 Secure admin authentication

## Setup

1. **Install dependencies:**
   ```bash
   cd mobile
   npm install
   ```

2. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Add your Supabase credentials:
     ```
     SUPABASE_URL=your_supabase_url
     SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

3. **Run the app:**
   ```bash
   npm start
   ```

4. **Test on device:**
   - Install Expo Go on your iOS or Android device
   - Scan the QR code shown in the terminal
   - Or press `a` for Android emulator or `i` for iOS simulator

## Usage

### Login
Use the same admin credentials as the web dashboard.

### View Leads
- Browse all leads with pull-to-refresh
- Phone numbers are prominently displayed
- Tap any lead to view details

### Call Leads
- Tap the phone number button to instantly call
- Works on both iOS and Android

### Edit Leads
- Tap "Edit Lead" button on detail screen
- Update any field
- Save changes (syncs with Supabase)

## Project Structure

```
mobile/
├── App.js                          # Main app with navigation
├── app.json                        # Expo configuration
├── package.json                    # Dependencies
└── src/
    ├── lib/
    │   └── supabaseClient.js      # Supabase configuration
    └── screens/
        ├── LoginScreen.js         # Admin authentication
        ├── LeadsScreen.js         # List of all leads
        └── LeadDetailScreen.js    # View/edit lead details
```

## Tech Stack

- **Framework:** React Native + Expo
- **Navigation:** React Navigation
- **Backend:** Supabase (shared with web app)
- **Storage:** AsyncStorage for persistent sessions

## Development

The app uses the same Supabase instance as the web dashboard, so all data is synced in real-time.

## Building for Production

### Android
```bash
eas build --platform android
```

### iOS
```bash
eas build --platform ios
```

Note: You'll need to configure EAS (Expo Application Services) for production builds.
