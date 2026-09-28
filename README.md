# FieldServe CRM

FieldServe is a mobile-first customer and operations platform for small field-service businesses. It was developed as a University of London CM3070 project and validated in a vehicle-detailing context. The Expo application supports web and native clients; business records, bookings, inspections, and analytics are served by a Django API with a separate FastAPI machine-learning service.

This repository is a research prototype. It is not a production-ready service, and model outputs or local benchmark results should not be treated as operational guarantees.

## Capabilities

- Manage businesses, team memberships, service catalogues, customers, and bookings.
- Switch a business between mobile service and fixed-location operation, with corresponding schedule and map views.
- Accept public bookings through a business-specific link, with service selection, availability suggestions, address lookup, and customer prefill.
- Track job status and assignment; collect before/after vehicle walkaround photos, indemnity signatures, and damage annotations.
- Review churn scores and retention signals, geographic demand summaries, and vehicle inspection detections.
- Deliver notification updates through Django Channels/WebSockets, backed by Redis and Celery.

Scheduling checks appointment gaps, work hours, job duration, and travel buffers. It does not automatically reorder confirmed appointments. The OR-Tools route experiment is in a research notebook and is not integrated into the running ML API. Churn, demand forecasting, and computer-vision features have different evidence levels; see [REPORT_TEST_EVIDENCE.md](REPORT_TEST_EVIDENCE.md) for recorded tests and evaluation caveats.

## Architecture

| Component | Technology | Local endpoint / purpose |
|---|---|---|
| CRM client | React Native, Expo Router | Web, Android, and iOS client |
| Application API | Django REST Framework, Django Channels | `http://localhost:8000` |
| ML API | FastAPI | `http://localhost:8001`; interactive docs at `/docs` |
| Database | PostgreSQL with PostGIS | `localhost:5432` |
| Cache and task queue | Redis, Celery | `localhost:6379` |
| Background maintenance | Django management-command scheduler | Separate Compose service |
| Optional road routing | OSRM | Compose `routing` profile; requires local prepared map data |

Docker Compose is the local development topology. `render.yaml` and `fieldserve-crm/vercel.json` describe deployment components, but external services, credentials, persistent storage, and background workers still require environment-specific configuration.

## Local development

### Prerequisites

- Docker Desktop with Compose
- Node.js 20 LTS or newer and npm
- Expo Go installed on an Android or iOS phone
- A Clerk development instance for authenticated app flows

### Download and configure the project

Download the repository ZIP from GitHub and extract it, or clone the repository. Open PowerShell in the extracted `FieldServe` folder. Start Docker Desktop before continuing.

Create the backend environment file and open it for editing:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

To open the same file in VS Code instead, run this from the repository root:

```powershell
code .env
```

Set `DJANGO_SECRET_KEY` to a random local-only value (generate one with `python -c "import secrets; print(secrets.token_urlsafe(48))"`). Configure `CLERK_SECRET_KEY`, `CLERK_JWKS_URL`, and `CLERK_ISSUER` as described in [Get the development keys](#get-the-development-keys). Keep `CLERK_WEBHOOK_SECRET` as a placeholder for the basic sign-up/login flow; it is only needed when testing Clerk webhooks. `GOOGLE_PLACES_SERVER_KEY` is optional and enables server-side address lookup. Do not commit `.env`.

### Get the development keys

Use a **Clerk development instance**, not production keys. The mobile publishable key and backend secret key must come from the same instance.

1. Sign in to the [Clerk Dashboard](https://dashboard.clerk.com/) and create a development application. Enable the sign-in methods you want to demo, such as email and password. To demo Google sign-in, enable Google under the application's social connections as well.
2. Open **API Keys**. Copy the **Publishable key** (`pk_test_...`) to `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `fieldserve-crm/.env.local`. Copy the **Secret key** (`sk_test_...`) to `CLERK_SECRET_KEY` in the root `.env`. Never put the secret key in the Expo environment file or in Git.
3. In the Clerk Dashboard, copy the development instance's Frontend API/domain URL, for example `https://example.clerk.accounts.dev`. Set `CLERK_ISSUER` to that URL without a trailing slash and `CLERK_JWKS_URL` to the same URL plus `/.well-known/jwks.json`. These two backend values and both keys must identify the same Clerk instance.
4. Sign up in the running app using an email address you can access to complete verification. For Google sign-in, configure the Google connection in Clerk; this is separate from the Google Maps key below.

For maps and address suggestions, create a Google key in the [Google Cloud Console](https://console.cloud.google.com/):

1. Create or select a Google Cloud project and enable billing for that project.
2. Under **APIs & Services > Library**, enable **Maps JavaScript API**, **Places API**, and **Geocoding API** as needed. The current autocomplete and backend address proxy call Google's legacy Places endpoints, and the backend's geocoding fallback uses Geocoding API. Enabling only **Places API (New)** is not sufficient. Google may require explicit legacy API activation for a new project; see [Google's legacy products guidance](https://developers.google.com/maps/legacy). The app does not need Directions, Distance Matrix, or Roads APIs.
3. Under **APIs & Services > Credentials**, create a client API key and restrict it to the APIs it uses (Maps JavaScript API and Places API). Put it in `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `fieldserve-crm/.env.local`. This value is included in the mobile bundle, so treat it as public: set quotas/budget alerts and do not reuse a production key. Expo Go uses Expo's native app identity, so an Android app restriction for FieldServe will not match Expo Go during development.
4. Optionally create a separate server key for Places and geocoding lookups and set it as `GOOGLE_PLACES_SERVER_KEY` in the root `.env`. Restrict it to Places API and Geocoding API, and your server's IP where possible. Never put this server key in the Expo environment file. Local core sign-in and CRM screens can run without Google keys, but Google map/address features will be unavailable or fall back to the non-Google map.

`.env.example` and `fieldserve-crm/.env.example` contain placeholders, not working credentials. A public GitHub ZIP cannot safely contain the Clerk secret or an unrestricted, billable Google key. If the project team provides shared development credentials, use those values in the ignored local env files; otherwise create your own development keys using the steps above. Never copy a production secret into either example file.

### Start the backend

From the repository root, build and start the local services. The first build can take several minutes:

```powershell
docker compose up --build -d
```

The backend image runs migrations during startup. Check services and logs with:

```powershell
docker compose ps
docker compose logs -f backend ml
```

The Compose file includes PostGIS, Redis, the Django backend, FastAPI ML service, Celery worker, and scheduler. OSRM is optional and is not started by the default command. To use it, prepare an OSRM-compatible map under `osrm-data/` and start the `routing` profile. To confirm the API is reachable from the development computer, open `http://localhost:8000/admin/` in a browser.

### Start Expo Go on a phone

Create the Expo environment file from its template:

```powershell
if (-not (Test-Path fieldserve-crm/.env.local)) { Copy-Item fieldserve-crm/.env.example fieldserve-crm/.env.local }
notepad fieldserve-crm/.env.local
```

To edit it in VS Code instead, run this from the repository root:

```powershell
code fieldserve-crm/.env.local
```

Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to the `pk_test_...` key from the Clerk steps above. Set `EXPO_PUBLIC_API_URL` to the development computer's LAN IPv4 address and port 8000, for example `http://192.168.1.25:8000`. Find the address with `ipconfig` and use the IPv4 address for the active Wi-Fi/Ethernet adapter, not `localhost` or a `169.254...` address. The phone and computer must be on the same Wi-Fi network. If using Google maps/address suggestions, also set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. Leave `EXPO_PUBLIC_CLERK_PROXY_URL` empty for a Clerk development instance.

Install the JavaScript dependencies and start Expo in LAN mode:

```powershell
Set-Location fieldserve-crm
npm ci
npx expo start --go --lan --clear
```

When the QR code appears, open **Expo Go** on the phone and scan it. Expo Go downloads and runs the JavaScript bundle; the Django/ML services remain running on the computer. If Windows Firewall asks, allow Node.js on the private network. If LAN discovery is blocked by the network, stop the server with `Ctrl+C` and retry using `npx expo start --go --tunnel --clear`.

For an Android emulator, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000` instead; `10.0.2.2` is the emulator's route to the host computer. For a physical phone, use the host computer's LAN IPv4 address. After changing `.env.local`, restart Expo so the new values are included in the bundle.

For EAS builds, set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in the corresponding EAS project environments (development, preview, and production); these values are intentionally no longer stored in `eas.json`. A Google Maps key appeared in earlier Git commits. Rotate it and restrict the replacement before using the repository publicly; deleting it from the current tree does not remove it from Git history.

### Install a preview APK on an Android phone

The current preview build is available from the [FieldServe Android build on Expo](https://expo.dev/accounts/netic-technologies-pty-ltd/projects/fieldserve-crm/builds/4e2732c7-c5b6-4a5f-86ca-4a97f29b460f). Open the build page on the phone or download its APK artifact and transfer it to the device.

Build an internal preview APK from the CRM directory:

```powershell
cd fieldserve-crm
eas build --platform android --profile preview
```

Download the APK from the EAS build page or its build link. Install only an APK produced by your own FieldServe EAS project. You can transfer it to the phone and open it, or install it over USB from Windows:

```powershell
adb devices
adb install -r .\path\to\fieldserve-preview.apk
adb shell monkey -p fieldserve.crm 1
```

If Android blocks the install, allow only the app you used to open the APK (for example, Chrome or Files) to install unknown apps. On most Android versions, open **Settings > Apps > Special app access > Install unknown apps**, select that source, and enable **Allow from this source**. Menu names vary by manufacturer. Turn this permission off again after installing.

Some phones have an additional manufacturer blocker. On a personal Samsung device, **Settings > Security and privacy > Auto Blocker** may prevent sideloading; only if you have verified that the APK came from your own EAS build, temporarily disable that blocker for installation and re-enable it immediately. Do not turn off Google Play Protect or general device protection. Do not bypass a work/school management policy or install an APK whose source you cannot verify.

### Run the app on an Android emulator from a terminal

Start the backend with Docker Compose, then configure `fieldserve-crm/.env.local` for the emulator. Android emulators reach services on the development host through `10.0.2.2`, not `localhost`:

```text
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_development_key
```

Create/start an Android Virtual Device (AVD). With the Android SDK tools on `PATH`, list and launch one in a terminal:

```powershell
emulator -list-avds
emulator -avd "Pixel_8_API_35"
```

Replace `Pixel_8_API_35` with an AVD name printed by the first command.

In a second terminal, start Expo and open the app on the running emulator:

```powershell
cd fieldserve-crm
npm ci
npm run android
```

Alternatively, after starting Metro with `npm start`, press `a` to open the Android target. The Android SDK's `adb` and `emulator` tools must be installed. If using a physical phone instead of an emulator, set `EXPO_PUBLIC_API_URL` to the development computer's LAN address and authorize USB debugging if installing with `adb`.

### Useful endpoints

- Django API: `http://localhost:8000/api/`
- Public booking API: `http://localhost:8000/api/public/`
- Django admin: `http://localhost:8000/admin/`
- ML health: `http://localhost:8001/health`
- ML API documentation: `http://localhost:8001/docs`

## Tests and checks

With the Compose backend running:

```powershell
docker compose exec -T backend pytest -q
docker compose exec -T backend python manage.py check
```

For the CRM:

```powershell
cd fieldserve-crm
npm test
npm run lint
npm exec tsc -- --noEmit
```

See [REPORT_TEST_EVIDENCE.md](REPORT_TEST_EVIDENCE.md) for dated test results, local load-test scope, model metrics, and research limitations. Results are tied to their stated datasets and test environments; they do not imply production capacity or generalization to real field-service businesses.

## Data and credentials

- Never commit `.env`, `.env.local`, provider credentials, signing secrets, or production data.
- `.env.example` contains placeholders only. Restrict Google API keys and use test Clerk credentials for local development.
- Large datasets and local training runs are excluded by ignore rules. Check dataset, pretrained-weight, and third-party service terms before redistributing related artifacts.
- The repository currently has no `LICENSE` file. Public visibility alone does not grant permission to reuse or redistribute the code; add a license only after choosing the intended terms.
