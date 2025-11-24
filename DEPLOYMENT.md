# Pricey Deployment Guide

## Production Deployment

### Quick Start

```bash
# 1. Build the frontend
npm run build

# 2. Start the production server
npm run api
```

The dashboard will be available at `http://localhost:3001`

### Single Command

```bash
npm run prod
```

This runs `npm run build && npm run api` automatically.

## What Happens

1. **Vite builds** the frontend (`web/` directory)
2. **Output goes to** `api/public/` directory
3. **Express serves** both the static files AND the API endpoints
4. **Single server** on port 3001 handles everything

## File Structure After Build

```
/pricey/
├── api/
│   ├── server.js          # Express server
│   └── public/            # Built frontend (auto-generated)
│       ├── index.html
│       ├── assets/
│       └── vite.svg
```

## Development vs Production

### Development Mode (Two Servers)
```bash
# Terminal 1: API server (port 3001)
npm run api

# Terminal 2: Vite dev server with HMR (port 5173)
npm run web
```

**Benefits:**
- Hot module replacement (HMR)
- Instant updates on code changes
- Better debugging with source maps
- Vite proxies `/api/*` to Express

### Production Mode (One Server)
```bash
npm run prod
```

**Benefits:**
- Single server process
- Optimized, minified assets
- Smaller file sizes (gzip compression)
- Faster load times
- Ready for deployment

## Environment Variables

Optional configuration via `.env`:

```bash
PORT=3001                    # API server port
DATABASE_URL=postgres://...  # PostgreSQL connection string
```

## Deployment Checklist

- [ ] PostgreSQL database set up and accessible
- [ ] Environment variables configured
- [ ] Frontend dependencies installed (`cd web && npm install`)
- [ ] Root dependencies installed (`npm install`)
- [ ] Frontend built (`npm run build`)
- [ ] Playwright browsers installed (for scraping)

## Deploying to a Server

### Option 1: VPS/Cloud Server (DigitalOcean, AWS, etc.)

```bash
# On server
git clone <your-repo>
cd pricey
npm install
cd web && npm install && cd ..
npm run build
pm2 start "npm run api" --name pricey
```

### Option 2: Docker (Future)

```dockerfile
# Dockerfile example (to be created)
FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN cd web && npm install && npm run build
EXPOSE 3001
CMD ["npm", "run", "api"]
```

## Process Management

Use PM2 for production process management:

```bash
# Install PM2
npm install -g pm2

# Start the server
pm2 start "npm run api" --name pricey-dashboard

# View logs
pm2 logs pricey-dashboard

# Restart
pm2 restart pricey-dashboard

# Stop
pm2 stop pricey-dashboard
```

## Nginx Reverse Proxy (Optional)

If running on a server, use Nginx for SSL and domain mapping:

```nginx
server {
    listen 80;
    server_name pricey.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Troubleshooting

### "Dashboard not built yet" Error

Run `npm run build` to create the frontend assets.

### Port Already in Use

Change the port in `api/server.js` or set `PORT` environment variable:

```bash
PORT=8080 npm run api
```

### Database Connection Issues

Verify PostgreSQL is running and accessible:

```bash
psql -d pricey -c "SELECT COUNT(*) FROM products;"
```

### Missing Frontend Dependencies

Make sure to install dependencies in both directories:

```bash
npm install           # Root dependencies
cd web && npm install # Frontend dependencies
```
