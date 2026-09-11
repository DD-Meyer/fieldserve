# DtailBase — Route Map Migration Plan
**Goal:** Replace Leaflet with Google Maps for display, keep route calculation on a self-hosted OSRM instance (OpenStreetMap data) to stay free and avoid Google's Directions API billing/ToS restrictions.

---

## 1. Google Cloud Console Setup

### 1.1 Project
- Use an existing Google Cloud project, or create a new one dedicated to DtailBase (`dtailbase-prod`, `dtailbase-dev` if you want separate keys per environment).

### 1.2 Enable APIs
In **APIs & Services → Library**, enable only:
- **Maps JavaScript API** (the embedded map/tiles)
- **Places API (New)** (you already use this for address autocomplete — confirm it's on this same project)

Do **not** enable Directions API, Distance Matrix API, or Roads API — you don't need them and enabling them is how accidental billing happens later if a stray call slips into the code.

### 1.3 Create API Key
**APIs & Services → Credentials → Create Credentials → API Key**

Then immediately restrict it (unrestricted keys are the #1 cause of Google Maps bill shock):
- **Application restrictions:** HTTP referrers (websites) — add your actual domains:
  - `https://dtailbase.com/*`
  - `https://*.dtailbase.com/*`
  - `http://localhost:5173/*` (Vite dev server, remove before going live or keep a separate dev key)
- **API restrictions:** restrict the key to only *Maps JavaScript API* and *Places API*. This means even if the key leaks, it can't be used to rack up charges on other Google services.

### 1.4 Billing account
- Maps JavaScript API requires a billing account attached even to stay within the free tier — this is normal, you just won't be charged under 10,000 map loads/month.
- **Set a budget alert:** Billing → Budgets & alerts → create a budget (e.g. $10) with email alerts at 50%/90%/100%. This is your tripwire if a bug causes runaway map loads.
- Optionally set a **daily quota cap** per API (APIs & Services → [API] → Quotas) so a bug can never exceed a fixed request count per day, regardless of budget alerts.

### 1.5 Separate keys per environment
Create a second, separately-restricted key for local/dev use so a leaked dev key (e.g. committed to git by accident) can't touch production traffic. Store both in environment variables — never hardcode.

---

## 2. Architecture Overview

```
┌─────────────────────┐        displays tiles/markers        ┌──────────────────────┐
│   React/Vite (UI)   │ ─────────────────────────────────────▶│  Google Maps JS API   │
│                      │                                       └──────────────────────┘
│  - renders map       │
│  - renders technician │
│    stop markers       │
│  - draws OSRM polyline │
│    as an overlay       │
└──────────┬───────────┘
           │  GET /api/routes/{route_id}/
           ▼
┌──────────────────────┐        route request         ┌────────────────────┐
│   Django backend      │ ─────────────────────────────▶│   OSRM container    │
│  - stores stops/coords│        (localhost:5000)       │  (OSM road network) │
│  - calls OSRM once,   │ ◀─────────────────────────────│  returns polyline,  │
│    caches result       │        route geometry         │  distance, duration │
└──────────────────────┘                                └────────────────────┘
```

Key principle: **Google never sees or provides the route geometry.** It only renders the base map and the markers/polyline that *you* computed via OSRM.

---

## 3. Backend — OSRM Setup (Django host)

1. **Get OSM data.** Download a regional or global extract from Geofabrik (`.osm.pbf`). Since you want global coverage, either:
   - Download continent-level extracts for the regions your detailers actually operate in (smaller, faster, easiest to keep updated), or
   - Use the full planet file if you genuinely need worldwide coverage (large — tens of GB — only do this if warranted).
2. **Preprocess the extract** with OSRM's backend (`osrm-extract`, `osrm-partition`, `osrm-customize`) using the car profile.
3. **Run `osrm-routed`** as a long-lived Docker service (`osrm-backend` image) on the same host/network as Django, exposed only internally (not publicly) — e.g. `localhost:5000` or an internal Docker network, not a public port.
4. **Django integration:**
   - New service module (e.g. `routing/osrm_client.py`) that calls the local OSRM `/route/v1/driving/{coords}` endpoint.
   - Cache the result (encoded polyline + distance + duration) against the route/stop-set in Postgres — recompute only when stops or their order change, not on every page load.
5. **Refresh cadence:** schedule a periodic job (cron/Celery beat) to re-run the extract/partition/customize steps against a fresh Geofabrik download — weekly is typically enough for road-network accuracy.

---

## 4. Frontend — React/Vite

1. Install a Google Maps React wrapper — `@vis.gl/react-google-maps` (actively maintained, official Google-recommended library) rather than hand-rolling the JS API.
2. Load the API key from an environment variable (`VITE_GOOGLE_MAPS_KEY`), never committed to source.
3. Render:
   - `<Map>` component for the base tiles/interaction
   - `<AdvancedMarker>` per stop (numbered pins, matching your current `1` / `2` badges)
   - A `<Polyline>` component whose `path` prop is the **decoded OSRM geometry** (decode the polyline string client-side or have Django return raw coordinate arrays — simpler to just send raw `[[lat, lng], ...]` from Django and skip polyline decoding entirely on the frontend).
4. Keep your existing Places Autocomplete component as-is — no change needed there.
5. "Open in Google Maps" button — unaffected, keep as a plain deep link (`https://www.google.com/maps/dir/?api=1&destination=...`), no API cost either way.

---

## 5. Copilot Task Breakdown

Give Copilot this as a checklist, one PR/task at a time rather than all at once:

1. `chore: add Google Maps JS API key via env var, install @vis.gl/react-google-maps`
2. `feat: replace Leaflet map container with Google Maps <Map> component (tiles/pan/zoom only, no route logic yet)`
3. `feat: render stop markers on Google Maps from existing stops data`
4. `infra: add osrm-backend Docker service + docker-compose entry, internal network only`
5. `feat(backend): OSRM client service in Django — call /route endpoint, return coords + distance + duration`
6. `feat(backend): cache computed route against stop-set, invalidate on stop/order change`
7. `feat(frontend): fetch cached route from Django API, render as Polyline on Google Map`
8. `chore: cron/Celery task to refresh OSM extract + rebuild OSRM data weekly`
9. `test: verify no Directions/Distance Matrix API calls are ever made to Google (grep codebase + check Cloud Console usage dashboard after a full smoke test)`

Step 9 is worth treating as a real checklist item — it's the easiest thing to regress on later if someone adds a "quick" Directions call without realizing the cost/ToS implications.
