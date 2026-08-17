# FieldServe — System Architecture

Visual map of how the FieldServe CRM components connect end-to-end.
All diagrams are [Mermaid](https://mermaid.js.org/) — they render natively in VS Code's Markdown preview and on GitHub.

---

## 1. High-level system map

Shows the major tiers (client, API, ML, data, third-party) and how requests flow between them.

```mermaid
flowchart LR
    subgraph Client["Client tier"]
        RN["React Native + Expo app<br/>(fieldserve-crm)<br/>iOS / Android / Web"]
    end

    subgraph Edge["Edge"]
        NGX["Reverse proxy / TLS<br/>(nginx in production)"]
    end

    subgraph API["Application tier"]
        DJ["Django REST API<br/>(fieldserve_backend, :8000)<br/>users · businesses · jobs · analytics · inspections"]
        FA["FastAPI ML service<br/>(ml_service, :8001)<br/>churn · heatmap · vision"]
    end

    subgraph Data["Data tier"]
        PG[("PostgreSQL + PostGIS<br/>:5432<br/>tenants · users · jobs · customers · geometry")]
        MOD[["ML model artefacts<br/>(ml_service/models)"]]
    end

    subgraph Ext["Third-party APIs"]
        MAP["Map tiles & geocoding<br/>(Mapbox / Google)"]
        AUTH["Clerk<br/>(JWT issuer)"]
    end

    RN -- HTTPS / JSON --> NGX
    NGX -- /api/* --> DJ
    DJ -- SQL (psycopg) --> PG
    DJ -- HTTP (internal) --> FA
    FA -- read features --> PG
    FA -- load --> MOD
    RN -- tiles --> MAP
    DJ -- verify token --> AUTH
```

---

## 2. Request lifecycle (typical read)

How a single user action — e.g. "open Schedule screen" — travels through the stack.

```mermaid
sequenceDiagram
    autonumber
    actor U as Field worker
    participant App as React Native app
    participant API as Django REST API
    participant DB as PostgreSQL/PostGIS
    participant ML as FastAPI ML service

    U->>App: Taps "Schedule" tab
    App->>API: GET /api/jobs/?date=today (JWT)
    API->>API: Authenticate, authorize tenant
    API->>DB: SELECT jobs WHERE tenant_id=? AND date=?
    DB-->>API: rows
    API-->>App: 200 JSON {jobs}
    App-->>U: Renders list + map
```

---

## 3. Backend app structure

How Django apps inside `fieldserve_backend/` relate, and which models each owns.

```mermaid
flowchart TB
    subgraph Core["core/ (project)"]
        SET["settings.py"]
        URL["urls.py"]
    end

    subgraph Apps["Django apps"]
        US["users/<br/>User, Profile"]
        BZ["businesses/<br/>Tenant, Membership"]
        JB["jobs/<br/>Job, Customer, Appointment"]
        AN["analytics/<br/>ChurnScore, HeatmapCell"]
        IN["inspections/<br/>Inspection, analysis results"]
    end

    Core --> US
    Core --> BZ
    Core --> JB
    Core --> AN
    Core --> IN

    BZ -- "owns" --> US
    BZ -- "owns" --> JB
    JB -- "feeds" --> AN
    JB -- "owns" --> IN
    IN -- "feeds" --> AN
    US -- "assigned to" --> JB
```

---

## 4. ML feature data flow

The three ML features each follow the same train-offline / serve-online pattern.

```mermaid
flowchart LR
    subgraph Train["Offline (training)"]
        RAW[("Historical transactions,<br/>locations + vehicle images")] --> ETL["Feature pipeline<br/>(RFM, geo, image labels)"]
        ETL --> TRN["Train models<br/>LR / RF / XGBoost / KDE / YOLOv8"]
        TRN --> ART[["Versioned artefacts<br/>*.pkl + vehicle_damage.pt"]]
    end

    subgraph Serve["Online (inference)"]
        REQ["Django request"] --> FAPI["FastAPI router"]
        ART --> FAPI
        FAPI -->|/churn/predict| C["Churn score"]
        FAPI -->|/heatmap/density| H["Demand grid"]
        FAPI -->|/vision/detect-damage| V["Damage detections"]
    end

    C --> RESP["JSON response"]
    H --> RESP
    V --> RESP
    RESP --> APP["React Native UI"]
```

---

## 5. Deployment topology (Docker Compose)

Mirrors what is in [docker-compose.yml](docker-compose.yml).

```mermaid
flowchart LR
    subgraph Host["Developer host / VM"]
        subgraph Net["docker network"]
            BE["backend<br/>:8000"]
            MLC["ml<br/>:8001"]
            DBC[("db<br/>postgis/postgis:15-3.3<br/>:5432")]
        end
        VOL[("postgres_data volume")]
    end

    DEV["Expo dev client / browser"] -->|localhost:8000| BE
    DEV -->|localhost:8001| MLC
    BE -->|POSTGRES_HOST=db| DBC
    BE -->|ML_SERVICE_URL=http://ml:8001| MLC
    DBC --- VOL
```

---

## 6. Authentication & multi-tenancy

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant App
    participant API as Django API
    participant DB

    U->>App: Login (email + password)
    App->>API: POST /api/auth/token
    API->>DB: Verify credentials, load memberships
    DB-->>API: user + tenant_id
    API-->>App: JWT {sub, tenant_id, role}
    App->>API: GET /api/jobs (Bearer JWT)
    API->>API: Decode JWT → set tenant filter
    API->>DB: SELECT … WHERE tenant_id=?
    DB-->>API: scoped rows
    API-->>App: 200 JSON
```

---

## How to view

- **VS Code**: open this file and press `Ctrl+K V` for side preview (built-in Markdown preview renders Mermaid).
- **GitHub**: diagrams render automatically in the file view.
- **Export**: install the *Markdown Preview Mermaid Support* extension to copy diagrams as PNG/SVG for the report.
