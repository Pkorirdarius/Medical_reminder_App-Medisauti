# MEDISAUTI
### Swahili Voice-Enabled Medication Adherence App for Patients & Doctors
**Kabarak University — Computer Science & IT · Darius Korir Pilakan (CS/M/1149/09/23)**

---

## Tech Stack

- **React Native** (Expo managed workflow, JavaScript, Hermes engine)
- **Supabase** — cloud backend (auth, database, Edge Functions, RLS)
- **Expo** ecosystem — camera, speech, notifications, file system, biometrics
- **Tesseract.js** — on-device OCR via hidden WebView
- **AI OCR** — cloud-based intelligent parsing via Gemini / GitHub Models (GPT-4o-mini)
- **aes-js** — AES-256-CTR encryption for local storage at rest (Hermes-compatible)
- **AsyncStorage** + **expo-secure-store** — offline-first local persistence & hardware-backed key storage

---

## Project Structure

```
medisauti/
├── App.js                              # Entry point — fonts, providers, navigation
├── app.json                            # Expo configuration + plugins + permissions
├── package.json                        # Dependencies
├── supabase-schema.sql                 # Database schema (7 tables + RLS policies)
├── .env                                # Environment variables (not committed)
├── supabase/
│   ├── functions/
│   │   ├── send-sms/index.ts           # Edge Function — Twilio SMS verification
│   │   └── verify-sms/index.ts        # Edge Function — verify SMS codes
│   └── migrations/
│       └── 001_security_hardening.sql  # Auth UIDs, audit log, RLS fixes
└── src/
    ├── navigation/
    │   └── AppNavigator.js             # Role-based navigation (patient/doctor tabs)
    ├── screens/
    │   ├── LandingScreen.js            # Pre-auth welcome + language selection
    │   ├── AuthScreen.js               # Registration, PIN login, biometrics, SMS reset
    │   ├── HomeScreen.js               # Dashboard — next reminder, meds, adherence, doctor link
    │   ├── ScanScreen.js               # Camera viewfinder, torch, gallery pick, recent scans
    │   ├── PrescriptionScreen.js       # OCR scan + manual entry + edit + saved prescriptions
    │   ├── RemindersScreen.js          # Daily schedule, mark-as-taken/snooze/missed
    │   ├── ReportScreen.js             # Analytics, streak, PDF/JSON/CSV export, trends
    │   ├── ProfileScreen.js            # Avatar, settings, notifications, theme, logout
    │   ├── DoctorScreen.js             # Doctor dashboard — patient adherence, streaks, prescribe
    │   ├── DoctorAnalyticsScreen.js    # Per-medication & per-condition analytics, trends
    │   ├── PatientSearchScreen.js      # Doctor search patients by name/condition
    │   └── PrescriptionScheduleScreen.js # Doctor issue prescriptions to patients
    ├── components/
    │   ├── ErrorBoundary.js            # React error boundary with recovery UI
    │   └── OfflineIndicator.js         # Network status banner (NetInfo)
    └── utils/
        ├── constants.js                # Design tokens — colors (light/dark), radius, shadows, fonts
        ├── storage.js                  # AES-encrypted AsyncStorage CRUD + Supabase sync + adherence calculations
        ├── reminders.js                # Expo Notifications + Expo Speech (Swahili TTS)
        ├── ocr.js                      # Tesseract.js WebView HTML + OCR text parser
        ├── ai.js                       # AI OCR parsing — Gemini & GitHub Models (GPT-4o-mini)
        ├── supabase.js                 # Supabase client — auth, CRUD, SMS, edge function calls
        ├── lang.js                     # Bilingual localization dictionary (437+ keys, SW/EN)
        ├── LanguageContext.js           # React context — Swahili/English i18n
        ├── ThemeContext.js              # React context — dark/light theme with persistence
        └── HighContrastContext.js       # React context — high-contrast accessibility mode
```

---

## Features

### Patient Features
- **Registration & PIN Login** — name, phone, age, medical condition; 4-digit PIN auth
- **Biometric Login** — fingerprint/face via `expo-local-authentication` (opt-in)
- **Prescription Management** — add/edit/delete meds with 10 dosage forms, duration, stock tracking
- **Camera OCR Scan** — real-time viewfinder, torch toggle, gallery pick, recent scans history
- **AI-Powered OCR** — Tesseract.js extracts text, then Gemini or GPT-4o-mini parses medication details intelligently
- **Swahili/English Localization** — full bilingual UI (437+ translation keys), persisted to AsyncStorage
- **Daily Reminders** — Expo Notifications with Swahili TTS (`sw-KE`), snooze, mark-as-taken/missed
- **Adherence Tracking** — dose logging with timestamps, streak calculation, per-medication analytics
- **Reports & Export** — HTML/PDF generation (`expo-print`), JSON/CSV data export, WhatsApp/email sharing
- **Doctor Linking** — browse and link to a doctor for remote monitoring
- **Dark Mode & High Contrast** — theme toggle, high-contrast accessibility mode for visually impaired
- **Offline Indicator** — network status banner when connectivity is lost

### Doctor Features
- **Doctor Dashboard** — select patients, view adherence %, 7-day streaks, recent activity
- **Per-Medication Analytics** — adherence breakdown by drug, source (doctor-issued vs. manual)
- **Patient Search** — filter by condition (diabetes, BP, HIV), grouped results with color coding
- **Prescription Scheduling** — issue prescriptions to patients with dosage, frequency, duration, start date
- **Condition Analytics** — aggregate adherence by condition group, trend direction (improving/worsening)

### Authentication & Security
- **Role-Based Access** — separate patient/doctor navigation and capabilities
- **PIN Reset via SMS** — Twilio Edge Functions send verification codes, verify, then reset PIN
- **Brute-Force Protection** — 5-attempt lockout with 30-second cooldown
- **Supabase RLS** — row-level security policies on all 7 tables
- **Security Audit Log** — tracks security events in dedicated table

---

## Modules → Screens Mapping

| Module | Screen/File | Key Technology |
|---|---|---|
| Auth & Registration | `AuthScreen.js` + `LandingScreen.js` | AsyncStorage, Supabase Auth, Biometrics |
| Prescription OCR | `ScanScreen.js` + `PrescriptionScreen.js` | Tesseract.js WebView, Gemini/GPT-4o-mini AI, ImagePicker |
| Reminders + Swahili TTS | `RemindersScreen.js` + `reminders.js` | Expo Notifications, Expo Speech (`sw-KE`) |
| Adherence Tracking + Reports | `ReportScreen.js` + `storage.js` | expo-print PDF, JSON/CSV export, expo-sharing |
| Profile & Settings | `ProfileScreen.js` | ImagePicker, notification sounds, theme/lang toggle |
| Doctor Dashboard | `DoctorScreen.js` | Per-patient adherence, streaks, prescribe |
| Doctor Analytics | `DoctorAnalyticsScreen.js` | Per-medication, per-condition, trend analysis |
| Patient Search | `PatientSearchScreen.js` | Condition filtering, full-text search |
| Prescription Scheduling | `PrescriptionScheduleScreen.js` | DateTimePicker, date range, frequency presets |

---

## Setup & Installation

### Prerequisites
- Node.js 18+ LTS
- npm or yarn
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Expo Go app on your Android/iOS device (for development)

### Environment Variables

Create a `.env` file in the project root:

```bash
# AI OCR (at least one required for AI parsing; falls back to regex without)
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
EXPO_PUBLIC_GITHUB_PAT=your_github_pat

# Supabase (optional; app works fully offline without these)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> **Note:** Without Supabase credentials, the app runs in offline-only mode using AsyncStorage.
> Without AI keys, OCR falls back to regex-based parsing.

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Start the Expo development server
npx expo start

# 3. Scan the QR code with Expo Go on your device
#    OR press 'a' for Android emulator / 'i' for iOS simulator
```

### Database Setup (Supabase)

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase-schema.sql` in the SQL Editor
3. Run `supabase/migrations/001_security_hardening.sql`
4. Deploy Edge Functions: `supabase functions deploy send-sms` and `supabase functions deploy verify-sms`
5. Copy your project URL and anon key into `.env`

### Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Build Android APK
eas build --platform android --profile preview

# Build iOS IPA (requires Apple Developer account)
eas build --platform ios
```

---

## Key Design Decisions

### Hybrid Cloud + Offline Architecture
The app operates in two modes:
- **With Supabase configured** — data syncs to cloud, enables doctor-patient features, SMS verification
- **Without Supabase** — fully offline via AsyncStorage; all core features work without internet

### Supabase Data Flow (v2 API Compatibility)
The app uses `@supabase/supabase-js` v2.110.0, which removed the synchronous `auth.currentUser`
property. All Supabase data queries (prescriptions, doctor links, adherence logs) depend on a cached
user UID (`_cachedUid` in `storage.js`) that is set:
- On successful login (`AuthScreen.handleLogin()`)
- On session restore from AsyncStorage (`AppNavigator.onAuthChanged`)
- On first load after app restart

Without this cache, `isFB()` returns `false` and the app silently falls back to local-only mode,
even with valid Supabase credentials. See `getUid()` in `src/utils/storage.js:225`.

### Offline Persistence
User data (prescriptions, adherence logs, doctor selection, schedules) is **not cleared on logout**.
Logout only terminates the Supabase session and cancels notification timers. On re-login, data is
proactively synced from Supabase and cached locally. This prevents data loss during normal logout/login
cycles. Local data is only purged on user switch (different phone number) or explicit app reinstall.

### AI-Powered OCR Pipeline
1. Tesseract.js runs in a hidden WebView to extract raw text from camera captures
2. Raw text is sent to Gemini (gemini-2.0-flash) or GitHub Models (GPT-4o-mini) for intelligent parsing
3. AI extracts drug name, dosage, form, frequency, and schedule times as structured JSON
4. Falls back to regex parsing when no AI provider is configured

### Swahili TTS
`expo-speech` supports the `sw-KE` language code. If the device's TTS engine
does not support Swahili, the code gracefully falls back to English (`en-US`).

### Bilingual Localization
437+ translation keys in `lang.js` cover all UI strings in both Swahili and English.
Language preference is persisted to AsyncStorage and toggleable from any screen.

### Role-Based Navigation
Patient and doctor roles have completely separate tab navigation and screen sets.
Doctors see analytics and patient management; patients see reminders and medication management.

### Hermes Engine Compatibility
The app targets Hermes (React Native 0.73.6), which lacks `TextEncoder`/`TextDecoder`,
`btoa`/`atob`, and the `AESEncryptionKey` API from newer `expo-crypto` versions.
Manual implementations replace these:
- Base64 encoding/decoding via byte-level `bytesToB64`/`b64ToBytes`
- UTF-8 conversion via `utf8ToBytes`/`bytesToUtf8` (using `encodeURIComponent`/`unescape`)
- AES-256-CTR via `aes-js` library instead of `expo-crypto`'s AES-GCM

### Adherence Logging
Every dose event (taken / missed / snoozed) is logged with a timestamp.
`calcAdherence()`, `getDailyStreak()`, `getPerMedicationAdherence()`, and `getAdherenceTrend()`
derive analytics entirely on-device from these logs.

### PDF & Data Export
Reports are generated as HTML via `expo-print` for native PDF generation.
Additional export formats include JSON and CSV via `expo-file-system`.
Sharing uses the native share sheet (WhatsApp, Gmail, SMS, etc.).

---

## Database Schema

7 tables with Row-Level Security:

| Table | Purpose |
|---|---|
| `users` | Patient/doctor profiles (UUID auth, phone, JSONB data) |
| `prescriptions` | Medication records per user |
| `adherence_logs` | Dose events (taken/missed/snoozed) with timestamps |
| `doctors` | Doctor profiles linked by phone |
| `schedules` | Reminder schedules per user |
| `my_doctor` | Patient-doctor relationships |
| `condition_presets` | Default prescriptions per medical condition |

---

## Notes for Supervisor

- Push notifications require a physical device; they will not fire in Expo Go on
  some Android simulators.
- Tesseract.js OCR requires internet on first load (CDN). For fully offline OCR,
  bundle the Tesseract WASM and `eng.traineddata` as Expo assets.
- The `android/` directory exists from a local `expo prebuild` — the app can also
  be built locally without EAS.
