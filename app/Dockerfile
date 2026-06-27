# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite bakes env at build time; values target the browser (host-mapped ports).
ARG VITE_USE_MOCK=false
ARG VITE_API_BASE_URL=http://localhost:4000
ARG VITE_WS_URL=ws://localhost:4000/realtime
ARG VITE_TRIAGE_URL=http://localhost:4100
ARG VITE_OTLP_URL=http://localhost:4318
ARG VITE_SERVICE_NAME=shiptivitas-app
ARG VITE_SERVICE_VERSION=0.1.0
ARG VITE_DEPLOY_ENV=docker
ENV VITE_USE_MOCK=$VITE_USE_MOCK \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_TRIAGE_URL=$VITE_TRIAGE_URL \
    VITE_OTLP_URL=$VITE_OTLP_URL \
    VITE_SERVICE_NAME=$VITE_SERVICE_NAME \
    VITE_SERVICE_VERSION=$VITE_SERVICE_VERSION \
    VITE_DEPLOY_ENV=$VITE_DEPLOY_ENV
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
