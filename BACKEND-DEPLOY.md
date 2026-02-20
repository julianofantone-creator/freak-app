# Deploy Backend to Railway (5 min)

The frontend is live at freak.cool. The backend (WebRTC signaling server) 
needs to be deployed so real video connections work for users.

## Steps

1. Go to https://railway.app — log in with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `julianofantone-creator/freak-app`
4. When prompted for the root directory, type: `server`
5. Railway will auto-detect Node.js and deploy

## After deploy

Railway will give you a URL like: `https://freak-server.railway.app`

Then update netlify.toml:
```toml
[context.production.environment]
  VITE_API_URL = "https://YOUR-RAILWAY-URL.railway.app"
```

Then redeploy Netlify (bro can do this via `netlify deploy --prod --dir=dist`)

## Environment variables to set in Railway

```
NODE_ENV=production
PORT=8080
JWT_SECRET=<generate a long random string>
FRONTEND_URL=https://freak.cool
```
