# ⚡ ReelMind — Vercel Production Deployment Guide

This guide walks you through deploying **ReelMind** (Autonomous AI Video Studio) to **Vercel** with both frontend client and backend Express API running seamlessly on a single domain.

---

## 🏗️ Vercel Architecture & Request Routing

```
                        User Browser
                             │
                             ▼
               https://reelmind.vercel.app
                             │
              ┌──────────────┴──────────────┐
              │      Vercel Edge Router     │
              └──────────────┬──────────────┘
                             │
             ┌───────────────┴───────────────┐
             ▼                               ▼
    /api/* Requests                  All Other Routes
  (Serverless Function)              (Static Assets SPA)
             │                               │
             ▼                               ▼
     [ api/index.ts ]                 [ client/dist ]
   Express.js API Engine             React 18 + Vite SPA
             │                               │
             ▼                               ▼
      MongoDB Atlas                    User Interface
  (Remote Cloud Cluster)            (Client-Side Routing)
```

- **Frontend**: Vite compiles `@reelmind/client` into `client/dist/`, which Vercel serves as high-speed static assets from the global Edge CDN.
- **Backend**: Express API is hosted via Vercel Serverless Function entry point at `api/index.ts`, handling all `/api/v1/*` endpoints.
- **Zero CORS Issues**: Because client and API share the exact same domain (`your-app.vercel.app`), browser requests are same-origin.

---

## 📋 Prerequisites

1. A free [Vercel Account](https://vercel.com).
2. A free [MongoDB Atlas Cluster](https://www.mongodb.com/cloud/atlas) (or any publicly accessible MongoDB connection string).
   - In MongoDB Atlas, go to **Network Access** > click **Add IP Address** > choose **Allow Access From Anywhere (`0.0.0.0/0`)** so Vercel Serverless dynamic IPs can connect.

---

## 🚀 Deployment Method 1: Deploy via Vercel Web Dashboard (Recommended)

### 1. Import Repository
1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** > **Project**.
3. Select your **`Shrawan3067/ReelMind`** GitHub repository and click **Import**.

### 2. Configure Project Settings
In the configuration screen, set:
- **Framework Preset**: `Vite` (or `Other`)
- **Root Directory**: `./` (leave default)
- **Build Command**: `npm run build` (detected automatically)
- **Output Directory**: `client/dist` (detected automatically via `vercel.json`)
- **Install Command**: `npm install` (detected automatically)

### 3. Add Environment Variables
Under the **Environment Variables** section, add the following:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Production mode |
| `MONGODB_URI` | `mongodb+srv://<user>:<password>@cluster0.mongodb.net/reelmind?retryWrites=true&w=majority` | Your MongoDB Atlas connection string |
| `JWT_ACCESS_SECRET` | `5e8f49a37e1b2c4d6a8f0e2b4c6d8a0f2e4b6c8d0a2f4b6c8d0e2f4a6b8c0d2e` | Secure 64-char key (`openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | `9b1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b` | Secure 64-char key (`openssl rand -hex 32`) |
| `ENCRYPTION_KEY` | `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` | Exact 64-character hex string (`openssl rand -hex 32`) |
| `AI_PROVIDER` | `none` (or `gemini`, `openai`, `anthropic`, `ollama`) | AI Creative Director provider |
| `AI_API_KEY` | *(Your AI provider key)* | Optional API key |

### 4. Click Deploy
Click **Deploy**. Vercel will install dependencies, build the shared and client workspaces, prepare the serverless function, and give you your live URL (e.g. `https://reelmind.vercel.app`)!

---

## 💻 Deployment Method 2: Deploy via Vercel CLI

If you have the `vercel` CLI installed locally:

```bash
# 1. Install Vercel CLI (if not already installed)
npm install -g vercel

# 2. Login to your Vercel account
vercel login

# 3. Deploy to production
vercel --prod
```

When prompted:
- **Set up and deploy?**: `Y`
- **Which scope?**: Select your account
- **Link to existing project?**: `N`
- **What’s your project’s name?**: `reelmind`
- **In which directory is your code located?**: `./`

---

## 🔍 Verifying the Deployment

1. **Web App**: Open `https://your-project.vercel.app/`
2. **Health Check**: Open `https://your-project.vercel.app/api/v1/health`
   Should return:
   ```json
   {
     "success": true,
     "service": "reelmind-api",
     "version": "1.0.0",
     "timestamp": "..."
   }
   ```
3. **Demo Account**: Sign up a new user or use the built-in demo dataset seeder directly from the UI.

---

## ⚙️ How Vercel Configuration Works in ReelMind

- [vercel.json](file:///Users/mac/Desktop/ReelMind/vercel.json):
  - Rewrites all `/api/(.*)` requests to the Serverless Function at `api/index.ts`.
  - Rewrites all other routes to `/index.html` for React client-side routing.
  - Sets 1024MB memory allocation and 60-second execution budget for AI operations.
- [api/index.ts](file:///Users/mac/Desktop/ReelMind/api/index.ts):
  - Bridges Vercel serverless requests into the Express application.
  - Uses Mongoose connection pooling to reuse database connections across warm lambda executions.
  - Normalizes rewritten URLs to match Express routes mounted at `/api/v1`.
- [server/src/config/env.ts](file:///Users/mac/Desktop/ReelMind/server/src/config/env.ts):
  - Automatically redirects `UPLOAD_DIRECTORY` and `THUMBNAIL_DIRECTORY` to `/tmp/` when running inside Vercel's serverless environment.
