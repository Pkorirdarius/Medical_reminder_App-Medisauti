# MEDISAUTI 💊
### A Swahili Voice-Enabled Mobile App for Medication Adherence
**Kabarak University — Computer Science & IT · Darius Korir Pilakan (CS/M/1149/09/23)**

---

## Recommended Language: React Native (JavaScript/TypeScript)

React Native was chosen because:
- **Cross-platform** — single codebase runs on Android 8+ and iOS 13+
- **Expo ecosystem** — camera, speech, notifications, file system out of the box
- **Tesseract.js** — on-device OCR runs in a hidden WebView (no server needed)
- **AsyncStorage** — offline-first local data storage; no cloud required
- **Expo Speech** — Swahili TTS (`sw-KE` locale) with English fallback

---

## Project Structure

```
medisauti/
├── App.js                          # Entry point
├── app.json                        # Expo configuration + permissions
├── package.json                    # Dependencies
└── src/
    ├── navigation/
    │   └── AppNavigator.js         # Bottom tab navigation (4 screens)
    ├── screens/
    │   ├── HomeScreen.js           # Dashboard — next reminder, meds list, adherence bar
    │   ├── PrescriptionScreen.js   # OCR scan + manual entry + saved prescriptions
    │   ├── RemindersScreen.js      # Daily schedule, mark-as-taken/snooze/missed
    │   └── ReportScreen.js         # Analytics, streak, PDF/HTML export for doctor
    └── utils/
        ├── constants.js            # Design tokens — colors, radius, shadows
        ├── storage.js              # AsyncStorage CRUD + adherence calculations
        ├── reminders.js            # Expo Notifications + Expo Speech (Swahili TTS)
        └── ocr.js                  # Tesseract.js WebView HTML + OCR text parser
```

---

## Modules → Screens Mapping

| Module (from proposal) | Screen/File | Key technology |
|---|---|---|
| Module 1: User Registration | `HomeScreen.js` (profile display) | AsyncStorage |
| Module 2: Prescription OCR | `PrescriptionScreen.js` | Tesseract.js via WebView, Expo ImagePicker |
| Module 3: Reminders + Swahili TTS | `RemindersScreen.js` + `reminders.js` | Expo Notifications, Expo Speech (`sw-KE`) |
| Module 4: Adherence Tracking + PDF | `ReportScreen.js` + `storage.js` | Expo Sharing, HTML report generation |

---

## Setup & Installation

### Prerequisites
- Node.js 18+ LTS
- npm or yarn
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Expo Go app on your Android/iOS device (for development)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Start the Expo development server
npx expo start

# 3. Scan the QR code with Expo Go on your device
#    OR press 'a' for Android emulator / 'i' for iOS simulator
```

### Building for production (APK / IPA)

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

### Offline-First Architecture
All core functions (viewing prescriptions, receiving reminders, logging doses,
generating reports) work without internet. Data is stored locally via AsyncStorage.

### OCR via WebView
Tesseract.js requires a browser JavaScript environment. We run it inside a hidden
`react-native-webview` WebView that loads Tesseract from CDN on first use. The
WebView posts progress and results back to the React Native layer via `onMessage`.

### Swahili TTS
`expo-speech` supports the `sw-KE` language code. If the device's TTS engine
does not support Swahili, the code gracefully falls back to English (`en-US`).

### Adherence Logging
Every dose event (taken / missed / snoozed) is logged with a timestamp to
AsyncStorage. `calcAdherence()` and `getDailyStreak()` derive analytics from
these logs entirely on-device.

### PDF Export
Reports are generated as HTML strings and saved via `expo-file-system`, then
shared via `expo-sharing` (which opens the native share sheet — WhatsApp, Gmail,
SMS, etc.). For true PDF, replace with `react-native-html-to-pdf` in production.

---

## Sprint Plan (from proposal)

| Sprint | Duration | Focus |
|---|---|---|
| 1 | Weeks 1–2 | Auth, registration, AsyncStorage persistence |
| 2 | Weeks 3–4 | OCR integration, prescription management |
| 3 | Weeks 5–6 | Reminder scheduling, Swahili TTS, notifications |
| 4 | Weeks 7–8 | Adherence logging, analytics, PDF export |
| 5 | Weeks 9–10 | UI polish, accessibility, device testing |

---

## Notes for Supervisor

- The `HomeScreen.js` import path for `reminders.js` has a typo in the path
  (`'../utilsinders/reminders'`) — correct to `'../utils/reminders'` before running.
- Tesseract.js OCR requires internet on first load (CDN). For fully offline OCR,
  bundle the Tesseract WASM and `eng.traineddata` as Expo assets.
- Push notifications require a physical device; they will not fire in Expo Go on
  some Android simulators.
