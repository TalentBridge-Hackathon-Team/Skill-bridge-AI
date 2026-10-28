# SkillBridge AI — React/Vite Frontend Dockerfile (production, multi-stage)

# ── Stage 1: build static assets ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install deps first (cached layer — only re-runs when package files change)
COPY package.json package-lock.json* ./
RUN npm ci

# Receive the backend API URL as a build argument so Vite can bake it in.
# Pass it when building: --build-arg VITE_API_BASE_URL=https://api.yourdomain.com/api
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN npm run build

# ── Stage 2: serve via nginx ──────────────────────────────────────────────────
FROM nginx:1.27-alpine

ENV PORT=80
ENV BACKEND_URL=http://backend:8000

# Copy the built bundle
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config template (uses $PORT and $BACKEND_URL via envsubst)
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

# nginx docker image automatically runs envsubst on /etc/nginx/templates/*.template
CMD ["nginx", "-g", "daemon off;"]
