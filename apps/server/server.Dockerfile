FROM node:20-alpine AS builder

WORKDIR /app


COPY package.json yarn.lock turbo.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/db/package.json ./packages/db/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn workspace @repo/db prisma generate

RUN yarn turbo run build --filter=server

RUN ls  /app/apps/server/dist || (echo "ERROR: dist not found!" && exit 1)
RUN ls  /app/apps/server/dist/index.js || (echo "ERROR: index.js not found!" && exit 1)

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN yarn global add  pm2

COPY --from=builder /app/apps/server/dist /app/apps/server/dist
COPY --from=builder /app/apps/server/package.json /app/apps/server/package.json
COPY --from=builder /app/apps/server/ecosystem.config.cjs /app/apps/server/ecosystem.config.cjs

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages /app/packages

COPY --from=builder /app/packages/db/prisma /app/packages/db/prisma

RUN ls  /app/apps/server/dist
RUN ls  /app/apps/server/dist/index.js

EXPOSE ${PORT:-4000}

