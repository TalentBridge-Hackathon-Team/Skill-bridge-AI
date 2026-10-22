# SkillBridge AI - React Frontend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for efficient layer caching
COPY package.json package-lock.json* ./
RUN npm install

# Copy application source code
COPY . .

EXPOSE 5173

# Start Vite dev server accessible from outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
