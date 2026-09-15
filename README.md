# MEDISAUTI

**Swahili Voice-Enabled Medication Adherence App for Patients & Doctors**

![React Native](https://img.shields.io/badge/React%20Native-0.73.6-61dafb?logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-50-black?logo=expo&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-2.110.0-3ecf8e?logo=supabase&logoColor=white)
![License](https://img.shields.io/badge/License-Unspecified-lightgrey)

**Kabarak University — Computer Science & IT · Darius Korir Pilakan (CS/M/1149/09/23)**

**Repository:** [github.com/Pkorirdarius/Medical_reminder_App-Medisauti](https://github.com/Pkorirdarius/Medical_reminder_App-Medisauti)

---

## About

MEDISAUTI is a cross-platform mobile app (React Native + Expo) that helps patients — particularly Swahili speakers in Kenya — take their medication correctly and on time, while giving doctors remote visibility into their patients' adherence.

Poor medication adherence is a major cause of treatment failure for chronic conditions such as diabetes, hypertension, and HIV. MEDISAUTI works around one core workflow:

1. **Scan** — Patients photograph paper prescriptions. On-device OCR (Tesseract.js) extracts the text, which AI (Gemini or GPT-4o-mini) parses into structured medication records (name, dosage, form, frequency, schedule), with a regex fallback when no AI provider is configured.
2. **Remind** — Daily dose reminders fire as push notifications and are announced aloud in **Swahili text-to-speech** (`sw-KE`), making the app accessible to low-literacy users.
3. **Track** — Every dose event (taken / missed / snoozed) is logged with a timestamp. Adherence percentages, streaks, per-medication breakdowns, and trends are computed entirely on-device.
4. **Share & Monitor** — Patients generate PDF/JSON/CSV reports shareable via WhatsApp or email, and can link to a doctor who monitors adherence, issues prescriptions remotely, and views aggregate analytics.

**Key characteristics:**

- **Bilingual UI** — Full Swahili/English localization (~378 translation keys), switchable at any time.
- **Offline-first** — All core features work without internet using AES-256-encrypted local storage; cloud sync via Supabase activates automatically when configured.
- **Accessible** — Dark mode and a high-contrast mode for visually impaired users.
- **Secure** — Role-based access (patient vs. doctor), 4-digit PIN + biometric login, SMS-based PIN reset with brute-force protection, and Row-Level Security across all backend tables.

---

## Tech Stack

- **React Native** — Expo managed workflow, JavaScript, Hermes engine (0.73.6)
- **Supabase** — cloud backend (auth, database, Edge Functions, RLS)
- **Expo ecosystem** — camera, speech, notifications, file system, biometrics
- **Tesseract.js** — on-device OCR via hidden WebView
- **AI OCR** — cloud-based intelligent parsing via Gemini / GitHub Models (GPT-4o-mini)
- **aes-js** — AES-256-CTR encryption for local storage at rest (Hermes-compatible)
- **AsyncStorage** + **expo-secure-store** — offline-first local persistence & hardware-backed key storage
- **Twilio** — SMS verification codes via Supabase Edge Functions (PIN reset)

---

## Project Structure

```
medisauti/
├── App.js                              # Entry point — fonts, providers, navigation
├── app.json                            # Expo configuration + plugins + permissions
├── package.json                        # Dependencies
├── supabase-schema.sql                 # Database schema (7 base tables + RLS)
├── .env                                # Environment variables (not committed)
├── supabase/
│   ├── functions/
│   │   ├── send-sms/index.ts           # Edge Function — Twilio SMS verification
│   │   └── verify-sms/index.ts         # Edge Function — verify SMS codes
│   └── migrations/
│       └── 001_security_hardening.sql  # Auth UIDs, audit log, SMS codes, RLS fixes
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
        ├── constants.js                # Design tokens — colors, radius, shadows, fonts
        ├── storage.js                  # AES-encrypted storage CRUD + Supabase sync + analytics
        ├── reminders.js                # Notifications + Swahili TTS + sound preferences
        ├── ocr.js                      # Tesseract.js WebView HTML + OCR text parser
        ├── ai.js                       # AI OCR parsing — Gemini & GitHub Models (GPT-4o-mini)
        ├── supabase.js                 # Supabase client — auth, CRUD, SMS edge functions
        ├── lang.js                     # Bilingual localization dictionary (~378 keys)
        ├── LanguageContext.js          # React context — Swahili/English i18n
        ├── ThemeContext.js             # React context — dark/light theme with persistence
        └── HighContrastContext.js      # React context — high-contrast accessibility mode
```

---

## Features

### Patient Features
- **Registration & PIN Login** — name, phone, age, medical condition; 4-digit PIN auth
- **Biometric Login** — fingerprint/face via `expo-local-authentication` (opt-in)
- **Prescription Management** — add/edit/delete meds with 10 dosage forms, duration, stock tracking
- **Camera OCR Scan** — real-time viewfinder, torch toggle, gallery pick, recent scans history
- **AI-Powered OCR** — Tesseract.js extracts text, then Gemini or GPT-4o-mini parses medication details intelligently
- **Swahili/English Localization** — full bilingual UI (~378 translation keys), persisted to AsyncStorage
- **Daily Reminders** — Expo Notifications with Swahili TTS (`sw-KE`), snooze, mark-as-taken/missed, custom notification sound
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
- **Brute-Force Protection** — 5-attempt lockout with 30-second cooldown; server-side SMS rate limiting (max 3 codes per phone / 10 min)
- **Supabase RLS** — row-level security policies on all backend tables
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
# AI OCR (Groq is primary; Gemini optional — falls back to regex without)
EXPO_PUBLIC_GROQ_API_KEY=your_groq_api_key
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key

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
2. Run `supabase-schema.sql` in the SQL Editor (7 base tables + RLS policies)
3. Run the security migration: `supabase/migrations/001_security_hardening.sql`
   (adds `sms_codes` and `security_audit_log` tables + stored procedures)
4. Deploy Edge Functions and set their secrets:

   ```bash
   supabase functions deploy send-sms
   supabase functions deploy verify-sms

   # Set Edge Function secrets (required for SMS to work)
   supabase secrets set TWILIO_ACCOUNT_SID=your_account_sid \
     TWILIO_AUTH_TOKEN=your_auth_token \
     TWILIO_FROM_NUMBER=your_twilio_phone
   ```

   > The Edge Functions also use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   > (set automatically when the functions are deployed).

5. Copy your project URL and anon key into `.env`

### Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure build credentials once
npx eas credentials

# Build Android APK (shareable, installable directly)
eas build --platform android --profile preview

# Build release AAB (for Google Play Store)
eas build --platform android --profile production

# Build iOS IPA (requires Apple Developer account)
eas build --platform ios
```

---

## Production Deployment (Free)

This app is a native mobile app, so "hosting" means **building the app and distributing the
installable APK**. Everything below is free.

### Option A — EAS Build + GitHub Releases (recommended, $0)

1. **Create a free Expo account** at [expo.dev](https://expo.dev) and run `eas login`.
   - Free tier includes unlimited **EAS Build** (APK/AAB) for personal projects.
2. **Initialize the project once:**
   ```bash
   npx eas-cli init
   npx eas credentials   # generates a production signing keystore (auto-managed)
   ```
3. **Create a GitHub repo** (or use the existing one) and push:
   ```bash
   git push -u origin main
   ```
4. **Add GitHub repository secrets** (Settings → Secrets → Actions):
   - `EXPO_TOKEN` — from [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens)
   - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_GROQ_API_KEY`, `EXPO_PUBLIC_GEMINI_API_KEY`
5. **Trigger a build** by pushing a version tag (or run the workflow manually):
   ```bash
   git tag v1.0.0 && git push origin v1.0.0
   ```
   The included workflow (`.github/workflows/build-apk.yml`) builds the APK on EAS and
   attaches it to a **GitHub Release** — a free, permanent download link you can share.

### Option B — Google Play Store (free to publish, $25 one-time dev account)

```bash
eas build --platform android --profile production     # produces an .aab
eas submit --platform android                          # uploads to Play Console
```
Requires a one-time $25 Google Play Developer registration. After approval your app is
publicly listed.

### Option C — Local APK build (no cloud)

The `android/` project already exists from `expo prebuild`. You can build the APK locally
with Android Studio or Gradle and send the file directly to testers — no store, no fee.

### Option D — OTA hotfixes / fast deploys (instant, $0)

Once a build is published, every future **JavaScript-only** change can be pushed straight
to production devices without a rebuild or store review (~2 minutes to go live):

```bash
npm run eas:update:production     # push to every installed production build
npm run eas:update:preview        # push to preview/test builds only
```

A CI workflow (`.github/workflows/deploy-updates.yml`) auto-deploys to the `production`
channel whenever `src/`, `App.js`, `app.json`, or `package.json` change on `main`.
Bumps to `app.json` `version` produce a new native runtime (users must update from the
store); everything else hot-swaps over the air.

### Environment variables for OTA updates

```bash
eas env:list                    # see existing vars
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://... --environment production
```

> **Never commit `.env`.** Use `.env.example` (committed) as the template and real values
> via `eas env`, GitHub secrets, or the local `.env` file (gitignored).

### Release checklist before launch

- [ ] `.env` keys are real and rotated (APKs built by CI use GitHub secrets, not `.env`)
- [ ] `eas credentials` completed (production keystore, not the debug keystore)
- [ ] Version bumped in `app.json` (and `android/app/build.gradle`)
- [ ] Supabase functions deployed: `supabase functions deploy send-sms verify-sms`
- [ ] Edge-function secrets set (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
      `TWILIO_FROM_NUMBER`)
- [ ] Push-notification service is set up for production (expo-notifications)
- [ ] Smoke-test the `.aap`/`.apk` on a physical device before release

---

## Architecture & Key Design Decisions

### Hybrid Cloud + Offline Architecture
The app runs in two modes:
- **With Supabase configured** — data syncs to cloud, enabling doctor-patient features and SMS verification
- **Offline** — fully offline via AsyncStorage; all core features work without internet

### Supabase Data Flow (v2 API Compatibility)
The app uses `@supabase/supabase-js` v2, which removed the synchronous `auth.currentUser`
property. All Supabase queries depend on a cached user UID (`_cachedUid` in `storage.js`) that is
set on login, session restore, and first load. Without this cache, `isFB()` returns `false` and
the app silently falls back to local-only mode, even with valid Supabase credentials.
See `getUid()` in `src/utils/storage.js:228`.

### Offline Persistence
User data is **not cleared on logout** — logout only terminates the Supabase session and cancels
notification timers. On re-login, data is proactively synced from Supabase and cached locally.
Local data is only purged on user switch (different phone number) or app reinstall.

### AI-Powered OCR Pipeline
1. Tesseract.js runs in a hidden WebView to extract raw text from camera captures
2. Raw text is sent to Gemini (`gemini-2.0-flash`) or GitHub Models (`gpt-4o-mini`) for parsing
3. AI extracts drug name, dosage, form, frequency, and schedule as structured JSON
4. Falls back to regex parsing when no AI provider is configured

### Swahili TTS
`expo-speech` uses the `sw-KE` language code. If the device's TTS engine does not support
Swahili, the code falls back to English (`en-US`). Notification sounds are also user-configurable.

### Hermes Engine Compatibility
React Native 0.73.6's Hermes engine lacks `TextEncoder`/`TextDecoder`, `btoa`/`atob`, and newer
`expo-crypto` AES APIs. Manual implementations replace these: base64 via `bytesToB64`/`b64ToBytes`,
UTF-8 via `utf8ToBytes`/`bytesToUtf8`, and AES-256-CTR via `aes-js` instead of `expo-crypto`.

### Adherence Analytics
Every dose event (taken / missed / snoozed) is logged with a timestamp. Available analytics,
all computed on-device:
- `calcAdherence()` — overall & per-medication adherence percentages
- `getDailyStreak()` / `getCurrentStreak()` / `getBestStreak()` — streak tracking
- `getPerMedicationAdherence()` — breakdown by drug
- `getAdherenceTrend()` — trend over time
- `getMissedDosePatterns()` — patterns by time of day (morning/afternoon/evening/night)

### PDF & Data Export
Reports are generated as HTML via `expo-print` for native PDF generation, plus JSON/CSV via
`expo-file-system`. Sharing uses the native share sheet (WhatsApp, Gmail, SMS, etc.).

---

## Database Schema

9 tables, all with Row-Level Security:

| Table | Purpose |
|---|---|
| `users` | Patient/doctor profiles (UUID auth, phone, JSONB data) |
| `prescriptions` | Medication records per user |
| `adherence_logs` | Dose events (taken/missed/snoozed) with timestamps |
| `doctors` | Doctor profiles linked by phone |
| `schedules` | Reminder schedules per user |
| `my_doctor` | Patient-doctor relationships |
| `condition_presets` | Default prescriptions per medical condition |
| `sms_codes` | SMS verification codes for PIN reset (*added by migration*) |
| `security_audit_log` | Security event tracking (*added by migration*) |

The migration also creates two `SECURITY DEFINER` stored procedures used by the Edge Functions:
- `admin_update_user_password(target_user_id, new_encrypted_password)` — updates reused by PIN reset
- `get_user_by_phone(target_phone)` — user lookup by phone during PIN reset

---

## Notes for Supervisor

- Push notifications require a physical device; they may not fire in Expo Go on some
  Android simulators.
- Tesseract.js OCR requires internet on first load (CDN). For fully offline OCR,
  bundle the Tesseract WASM and `eng.traineddata` as Expo assets.
- The `android/` directory exists from a local `expo prebuild` — the app can also
  be built locally without EAS.

---

## Contributing

1. Fork the repository and create a feature branch (`git checkout -b feature/my-feature`)
2. Install dependencies with `npm install`
3. Test your changes locally with `npx expo start`
4. Ensure translations are added to `src/utils/lang.js` for any new UI strings
5. Commit your changes and open a pull request describing the change

## License

No license has been specified for this project yet.