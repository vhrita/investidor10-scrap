FROM node:20.13.1-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

FROM base AS production

WORKDIR /app

COPY --from=base /app /app

ENV NODE_ENV=production
ARG PORT=3001
ENV PORT=${PORT}

RUN mkdir -p /app /tmp && chmod -R 777 /app /tmp
VOLUME /dev/shm

EXPOSE ${PORT}

CMD ["npm", "start"]