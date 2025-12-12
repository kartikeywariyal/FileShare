# Quick Deployment Guide

## 🚀 Ready to Deploy!

Your project is now configured for deployment. Here's what you need to know:

### ✅ What's Ready:

1. **Frontend** - Ready for Vercel/Netlify
   - ✅ `vercel.json` configured
   - ✅ `netlify.toml` configured
   - ✅ All API calls use environment variables
   - ✅ Build configuration ready

2. **Backend** - Ready for Railway/Render
   - ✅ Environment variables configured
   - ✅ `.env` file structure ready
   - ✅ CORS configured for production

### 📋 Deployment Steps:

#### Step 1: Deploy Backend (Railway - Recommended)

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Set root directory: `FileShare/backend`
5. Add environment variables:
   - `PORT` = `3001`
   - `JWT_SECRET` = `2eieo2mne` (or generate a new one)
   - `MONGODB_URI` = `mongodb+srv://kartikeywariyal:kartik%4012345@cluster0.envmfus.mongodb.net/fireshare?retryWrites=true&w=majority`
6. Copy your backend URL (e.g., `https://fireshare-backend.railway.app`)

#### Step 2: Deploy Frontend (Vercel - Recommended)

1. Go to [vercel.com](https://vercel.com) and sign up
2. Click "New Project" → Import your GitHub repo
3. Configure:
   - **Root Directory**: `FileShare/my-vite-app`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add environment variable:
   - **Name**: `VITE_API_URL`
   - **Value**: Your backend URL from Step 1
5. Deploy!

### 🔧 Alternative: Netlify for Frontend

1. Go to [netlify.com](https://netlify.com)
2. "Add new site" → "Import an existing project"
3. Connect GitHub repo
4. Settings:
   - Base directory: `FileShare/my-vite-app`
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Add environment variable: `VITE_API_URL` = Your backend URL
6. Deploy!

### ⚠️ Important Notes:

- **Backend cannot go on Vercel/Netlify** - Use Railway, Render, or similar
- **Frontend needs the backend URL** - Set `VITE_API_URL` environment variable
- **CORS is configured** - Backend will accept requests from your frontend
- **MongoDB is already set up** - Your connection string is ready

### 🧪 Test After Deployment:

1. Visit your frontend URL
2. Try signing up - should work!
3. Upload a file - should work!
4. Check browser console for any errors

### 📝 Environment Variables Summary:

**Frontend (Vercel/Netlify):**
```
VITE_API_URL=https://your-backend-url.railway.app
```

**Backend (Railway/Render):**
```
PORT=3001
JWT_SECRET=2eieo2mne
MONGODB_URI=mongodb+srv://kartikeywariyal:kartik%4012345@cluster0.envmfus.mongodb.net/fireshare?retryWrites=true&w=majority
```

### 🎉 You're All Set!

Your project is production-ready. Just follow the steps above and you'll have a live application!

