FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_BASE_PATH=/booster/
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run typecheck && npm run lint && npm test && npm run build

FROM node:24.18.0-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 BOOSTER_DB_PATH=/data/booster.sqlite
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && mkdir /data && chown node:node /data
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/*.js /app/server/*.html /app/server/*.css ./server/
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
