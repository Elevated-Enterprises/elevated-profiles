# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

ARG VITE_API_BASE_URL
ARG VITE_LOGIN_NUDGE_SNOOZE_MINUTES=10
ARG VITE_COMMUNITY_NAME=Second Circuit
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_LOGIN_NUDGE_SNOOZE_MINUTES=$VITE_LOGIN_NUDGE_SNOOZE_MINUTES
ENV VITE_COMMUNITY_NAME=$VITE_COMMUNITY_NAME

COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
