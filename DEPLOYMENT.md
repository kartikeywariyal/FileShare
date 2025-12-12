# Deployment Guide

## Overview

This project consists of two parts:
1. **Frontend** (React/Vite) - Can be deployed to Vercel or Netlify
2. **Backend** (Express/Node.js) - Needs separate hosting (Railway, Render, etc.)

## Frontend Deployment (Vercel/Netlify)

### Option 1: Deploy to Vercel

1. **Install Vercel CLI** (optional):
```bash
npm i -g vercel
```

2. **Deploy from Vercel Dashboard**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Set root directory to: `FileShare/my-vite-app`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Add environment variable:
     - `VITE_API_URL` = Your backend URL (e.g., `https://your-backend.railway.app`)

3. **Or deploy via CLI**:
```bash
cd my-vite-app
vercel
```

### Option 2: Deploy to Netlify

1. **Install Netlify CLI** (optional):
```bash
npm i -g netlify-cli
```

2. **Deploy from Netlify Dashboard**:
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository
   - Set build settings:
     - Base directory: `FileShare/my-vite-app`
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Add environment variable:
     - `VITE_API_URL` = Your backend URL

3. **Or deploy via CLI**:
```bash
cd my-vite-app
netlify deploy --prod
```

## Backend Deployment

**Important**: Express servers cannot be directly deployed to Vercel/Netlify. You need a Node.js hosting service.

### Recommended: Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Set root directory to: `FileShare/backend`
5. Add environment variables:
   - `PORT` = 3001 (or leave default)
   - `JWT_SECRET` = Your secret key
   - `MONGODB_URI` = Your MongoDB connection string
6. Railway will automatically detect Node.js and deploy

### Alternative: Render

1. Go to [render.com](https://render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - Name: `fireshare-backend`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Root Directory: `FileShare/backend`
5. Add environment variables:
   - `PORT` = 3001
   - `JWT_SECRET` = Your secret key
   - `MONGODB_URI` = Your MongoDB connection string

### Alternative: Heroku

1. Install Heroku CLI
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Set environment variables:
```bash
heroku config:set JWT_SECRET=your-secret
heroku config:set MONGODB_URI=your-mongodb-uri
```
5. Deploy: `git push heroku main`

## Environment Variables Setup

### Frontend (.env in my-vite-app/)
```env
VITE_API_URL=https://your-backend-url.com
```

### Backend (.env in backend/)
```env
PORT=3001
JWT_SECRET=your-secret-key
MONGODB_URI=your-mongodb-connection-string
```

## CORS Configuration

After deploying backend, update CORS in `backend/server.js` to include your frontend URL:

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'https://your-frontend.vercel.app',
  'https://your-frontend.netlify.app'
];
```

## Step-by-Step Deployment

1. **Deploy Backend First**:
   - Deploy to Railway/Render
   - Get your backend URL (e.g., `https://fireshare-backend.railway.app`)
   - Test the API endpoints

2. **Update Frontend Environment**:
   - Create `.env` in `my-vite-app/` with:
     ```
     VITE_API_URL=https://your-backend-url.com
     ```

3. **Deploy Frontend**:
   - Deploy to Vercel/Netlify
   - Add environment variable `VITE_API_URL` in the dashboard
   - Your app should now work!

## Testing After Deployment

1. Check backend health: `https://your-backend-url.com/api/auth/signup` (should return error, not 404)
2. Check frontend: Visit your frontend URL
3. Try signing up - should connect to backend

## Troubleshooting

- **CORS Errors**: Make sure backend CORS includes your frontend URL
- **API Not Found**: Check that `VITE_API_URL` is set correctly
- **Build Fails**: Make sure all dependencies are in `package.json`
- **Backend Not Starting**: Check environment variables are set correctly

## Free Hosting Options Summary

| Service | Frontend | Backend | Free Tier |
|---------|----------|---------|-----------|
| Vercel | ✅ Yes | ❌ No | ✅ Yes |
| Netlify | ✅ Yes | ❌ No | ✅ Yes |
| Railway | ❌ No | ✅ Yes | ✅ Yes (limited) |
| Render | ❌ No | ✅ Yes | ✅ Yes (limited) |
| Heroku | ❌ No | ✅ Yes | ❌ No (paid only) |

