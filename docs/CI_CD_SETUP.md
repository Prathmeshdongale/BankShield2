# BankShield — CI/CD Setup Guide (Jenkins + Docker + Vercel + Render)

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        JENKINS (Windows Local)                                │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │ Build Backend │  │ Build ML Svc  │  │ Build Frontend│                      │
│  │   (Docker)    │  │   (Docker)    │  │   (Vercel)    │                      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                       │
│         │                  │                   │                               │
└─────────┼──────────────────┼───────────────────┼───────────────────────────┘
          │                  │                   │
          ▼                  ▼                   ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │   Render.com   │   │   Render.com   │   │   Vercel     │
   │  Express API   │   │  FastAPI ML    │   │  React SPA   │
   │ bankshield-api │   │ bankshield-ml  │   │ bankshield   │
   │ .onrender.com  │   │ .onrender.com  │   │ .vercel.app  │
   └───────┬────────┘   └───────┬────────┘   └──────┬───────┘
           │                    │                    │
           │     PostgreSQL      │                    │
           │    (Neon Cloud)     │                    │
           └─────────────────────┘                    │
                    ↕                                │
              bankshield-ml                           │
              .onrender.com ←────────────────────────┘
                    (ML_SERVICE_URL)
```

## Three Independently Deployable Applications

| # | Application | Tech | Deploy Target | Docker |
|---|---|---|---|---|
| 1 | Frontend | React 19 + Vite | Vercel | No (Vercel builds) |
| 2 | Backend API | Node.js + Express 5 | Render | Yes |
| 3 | ML Service | Python + FastAPI + XGBoost | Render | Yes |

---

## Step 1: Install Jenkins on Windows

### 1.1 Prerequisites
```powershell
# Install Java 17 (required by Jenkins)
winget install Microsoft.OpenJDK.17

# Install Docker Desktop
winget install Docker.DockerDesktop

# Install Node.js 22 (for Vercel CLI)
winget install OpenJS.NodeJS.LTS

# Install Git
winget install Git.Git
```

### 1.2 Install Jenkins
```powershell
# Download Jenkins LTS Windows installer
Invoke-WebRequest -Uri "https://get.jenkins.io/windows-stable/latest/jenkins.msi" -OutFile "$env:TEMP\jenkins.msi"

# Install silently
Start-Process msiexec.exe -ArgumentList "/i $env:TEMP\jenkins.msi /quiet" -Wait

# Jenkins runs as Windows service at http://localhost:8080
```

### 1.3 Initial Jenkins Setup
1. Open `http://localhost:8080` in browser
2. Get initial password:
   ```powershell
   Get-Content "C:\Program Files\Jenkins\secrets\initialAdminPassword"
   ```
3. Install suggested plugins
4. Create admin user
5. Install additional plugins:
   - **Docker Pipeline** (for Docker builds)
   - **Pipeline: GitHub** (for webhook triggers)
   - **Credentials Binding** (for secrets)

---

## Step 2: Configure Jenkins Credentials

Go to **Jenkins > Manage Jenkins > Credentials > System > Global** and add:

| Credential ID | Type | Value |
|---|---|---|
| `VERCEL_TOKEN` | Secret text | Your Vercel personal access token |
| `VERCEL_ORG_ID` | Secret text | Your Vercel team/org ID |
| `VERCEL_PROJECT_ID` | Secret text | Vercel project ID for BankShield |
| `RENDER_API_KEY` | Secret text | Render.com API key |
| `RENDER_SERVICE_API` | Secret text | Render service ID for Express API |
| `RENDER_SERVICE_ML` | Secret text | Render service ID for ML service |
| `DATABASE_URL` | Secret text | PostgreSQL connection string |
| `JWT_SECRET` | Secret text | JWT access token secret |
| `JWT_REFRESH_SECRET` | Secret text | JWT refresh token secret |

### How to get each token:

**Vercel Token:**
1. Go to https://vercel.com/account/tokens
2. Create new token → copy value
3. Org ID: `vercel.com > Settings > General > ID`
4. Project ID: `vercel.com > [project] > Settings > General > Project ID`

**Render API Key:**
1. Go to https://render.com > Account Settings > API Keys
2. Create API key → copy value
3. Service IDs: Dashboard > Service > Settings > Service ID

---

## Step 3: Create Render Services

### 3.1 Express API Backend
1. Go to https://render.com > New > Web Service
2. Connect your Git repository
3. Configure:
   - **Name:** `bankshield-api`
   - **Runtime:** Docker
   - **Dockerfile Path:** `./server/Dockerfile`
   - **Health Check:** `/health`
   - **Environment Variables:**
     ```
     NODE_ENV=production
     PORT=5000
     DATABASE_URL=<your-neon-postgres-url>
     ML_SERVICE_URL=https://bankshield-ml.onrender.com
     JWT_SECRET=<your-jwt-secret>
     JWT_REFRESH_SECRET=<your-refresh-secret>
     FRAUD_BLOCK_THRESHOLD=80
     FRAUD_FLAG_THRESHOLD=30
     API_RATE_LIMIT_MAX=500
     ```
4. Copy the Service ID from Settings

### 3.2 FastAPI ML Service
1. New > Web Service > Connect Git repo
2. Configure:
   - **Name:** `bankshield-ml`
   - **Runtime:** Docker
   - **Dockerfile Path:** `./ml-service/Dockerfile`
   - **Health Check:** `/health`
   - **Environment Variables:**
     ```
     MODEL_DIR=/app/saved_models
     PYTHONUNBUFFERED=1
     ```
3. Copy the Service ID from Settings

---

## Step 4: Create Vercel Project (Frontend)

1. Go to https://vercel.com > New Project
2. Import your Git repository
3. Configure:
   - **Root Directory:** `client`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add environment variable:
   ```
   VITE_API_URL=https://bankshield-api.onrender.com
   ```
5. Deploy
6. Copy Project ID and Org ID from Settings

---

## Step 5: Create Jenkins Pipeline Job

1. Jenkins > New Item > Pipeline
2. Name: `BankShield-CICD`
3. Configure:
   - **Pipeline > Definition:** Pipeline script from SCM
   - **SCM:** Git
   - **Repository URL:** `https://github.com/<your-username>/bankshield.git`
   - **Branch:** `*/main`
   - **Script Path:** `Jenkinsfile`
4. Save

---

## Step 6: Test Local Docker Build (Before Jenkins)

```powershell
# Test backend Docker build
cd "d:\B Tech\bankshield\server"
docker build -t bankshield-api:test .

# Test ML service Docker build
cd "d:\B Tech\bankshield\ml-service"
docker build -t bankshield-ml:test .

# Test full stack with Docker Compose
cd "d:\B Tech\bankshield"
docker compose up --build
```

---

## Step 7: Run the Pipeline

1. Push code to `main` branch → Jenkins auto-triggers
2. Or manually: Jenkins > BankShield-CICD > Build Now
3. Watch stages:
   - ✅ Checkout & Pre-flight
   - ✅ Build: Backend (Docker)
   - ✅ Build: ML Service (Docker)
   - ✅ Deploy: Frontend → Vercel
   - ✅ Deploy: Backend → Render
   - ✅ Deploy: ML Service → Render

---

## File Structure

```
bankshield/
├── Jenkinsfile                    # CI/CD pipeline definition
├── render.yaml                    # Render.com blueprint (both backend services)
├── docker-compose.yml            # Local full-stack Docker testing
├── server/
│   ├── Dockerfile                # Express API container (production)
│   └── .dockerignore
├── ml-service/
│   ├── Dockerfile                # FastAPI ML container (production)
│   └── .dockerignore
├── client/
│   ├── Dockerfile                # React build container (CI smoke test)
│   ├── vercel.json               # Vercel deployment config + API proxy
│   └── .dockerignore
└── docs/
    └── CI_CD_SETUP.md            # This file
```

---

## Pipeline Stages

| Stage | What Happens | Target |
|---|---|---|
| Checkout & Pre-flight | Verify credentials, Docker available | Local Jenkins |
| Build: Backend | Docker build Express API, health check | Local Docker |
| Build: ML Service | Docker build FastAPI, verify model loaded | Local Docker |
| Deploy: Frontend | `vercel --prod` CLI deploy | Vercel |
| Deploy: Backend | Render API trigger + health check | Render.com |
| Deploy: ML Service | Render API trigger + health check | Render.com |

**Deployment only triggers on `main` branch pushes.**

---

## Production URLs

| Service | URL |
|---|---|
| Frontend | https://bankshield.vercel.app |
| Express API | https://bankshield-api.onrender.com |
| ML Service | https://bankshield-ml.onrender.com |
| API Health | https://bankshield-api.onrender.com/health |
| ML Health | https://bankshield-ml.onrender.com/health |
