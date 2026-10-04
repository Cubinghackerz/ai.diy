FROM node:22-bookworm-slim

# Disable dependency installation telemetry before npm runs lifecycle scripts.
ENV OPENUI_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
