# Health RAG — Android app (Flutter)

Native Flutter Android app for the Health RAG Chatbot (Sunrise Family Clinic).
Talks to the same FastAPI backend as the website — **not** a WebView wrapper.

## Screens

- **Login** — JWT auth (`POST /auth/login`), roles doctor / staff / admin.
  Demo accounts (the project's documented seed accounts): `admin / admin123`,
  `doctor / doctor123`, `staff / staff123` — tap a chip to fill them in.
- **Chat** — ask questions, answers with source chips + highlighted excerpts,
  suggested questions, on-device chat history, voice input (mic button),
  answer language English / Hindi / Marathi.
- **Patients** — list from `GET /patients`, tap for details.
- **Visit** — clinic timings / fees / emergency policy from the real guide PDF,
  plus the live token queue (take a token, staff can call the next one).
- **More** — Upload PDFs (scanned ones are OCR-read by the backend),
  Test questions (runs the fixed set live against `/ask`),
  Admin dashboard (admin only: documents, questions, fallback rate, query log),
  How it works, Settings.

Every screen shows the disclaimer: decision-support only, not a replacement
for a doctor; synthetic demo data.

## Server address

The backend runs behind a free tunnel whose address rotates. The app defaults
to the current tunnel URL (see `lib/config.dart`) and lets the user change it
in **Settings → API server address** (persisted on device; changing it signs
you out). You can check the current tunnel URL in
`~/workspace/health-rag/tunnel-url.txt` on the VPS.

## Build

Toolchain (already installed on the VPS from the Campus Connect build):

```bash
export PATH=~/workspace/flutter-sdk/flutter/bin:$PATH
export ANDROID_HOME=~/workspace/android-sdk
export JAVA_HOME=~/workspace/android-sdk/jdk17
export JAVA_TOOL_OPTIONS="-Djava.net.preferIPv4Stack=true"
export GRADLE_OPTS="-Djava.net.preferIPv4Stack=true"
export CI=true
flutter analyze        # 0 errors
flutter test           # login + chat widget tests
flutter build apk --release
```

APK: `build/app/outputs/flutter-apk/app-release.apk`

**Before delivering an APK, always verify the INTERNET permission:**

```bash
~/workspace/android-sdk/build-tools/36.0.0/aapt2 dump badging \
  build/app/outputs/flutter-apk/app-release.apk | grep permission
```

`android.permission.INTERNET` must be listed — a previous app shipped without
it and sign-in failed with "Failed host lookup". The permission is declared
in `android/app/src/main/AndroidManifest.xml` (with `ACCESS_NETWORK_STATE`
and `RECORD_AUDIO` for voice input).
