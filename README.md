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
- Node.js and npm
- A Clerk development instance for authenticated app flows

### Configure and start the backend

From the repository root, create a local environment file and replace the placeholders with development values:

```powershell
Copy-Item .env.example .env
```

At minimum, set a strong `DJANGO_SECRET_KEY` and the Clerk backend values (`CLERK_SECRET_KEY`, `CLERK_JWKS_URL`, `CLERK_ISSUER`, and `CLERK_WEBHOOK_SECRET`) for authentication and webhooks. Set `ML_INTERNAL_TOKEN` to a locally generated secret if you will use administrative ML training endpoints. Keep real values out of Git.

Start the local services:

```powershell
docker compose up --build -d
```

The backend image runs migrations during startup. Check services and logs with:

```powershell
docker compose ps
docker compose logs -f backend ml
```

The Compose file includes PostGIS, Redis, the Django backend, FastAPI ML service, Celery worker, and scheduler. OSRM is optional and is not started by the default command. To use it, prepare an OSRM-compatible map under `osrm-data/` and start the `routing` profile.

### Start the CRM

Create `fieldserve-crm/.env.local` with the client configuration for your environment. For example:

```text
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_replace_me
```

Use your machine's LAN address instead of `localhost` when testing on a physical device. Configure Clerk proxy variables for the target platform: the deployed web app uses the Vercel same-origin proxy, while native proxy URLs must be absolute. Configure Google Places/Maps keys only when enabling the related address/map features, and keep server-side keys on the backend.

For EAS builds, set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in the corresponding EAS project environments (development, preview, and production); these values are intentionally no longer stored in `eas.json`. The Google Maps key was present in earlier Git commits. Rotate it and restrict the replacement to the required APIs and app origins before making the repository public. Removing a value from the current tree does not remove it from Git history.

Then run:

```powershell
cd fieldserve-crm
npm ci
npm run web
```

Use `npm start` to launch the Expo development server for native development. Authentication and external map/address integrations require valid provider configuration.

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
