# ---------------------------- #
# Etapa 1: Base com Node.js e Puppeteer
FROM node:20.13.1-alpine AS base

# Instalação das dependências necessárias para o Puppeteer
RUN apk update && apk upgrade && apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    libx11 \
    libxcomposite \
    libxdamage \
    libxi \
    libxtst \
    alsa-lib \
    bash \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copia apenas os arquivos de dependências e instala para otimizar o cache
COPY package*.json ./
RUN npm install --production

# Copia o restante do código
COPY . .

# ---------------------------- #
# Etapa 2: Produção
FROM base AS production

WORKDIR /app

COPY --from=base /app /app

ENV NODE_ENV=production

ARG PORT=3001
ENV PORT=${PORT}

# Garante permissões apropriadas no diretório da aplicação
RUN mkdir -p /app && chmod -R 777 /app

EXPOSE ${PORT}

# Executa a aplicação com npm start
CMD ["npm", "start"]