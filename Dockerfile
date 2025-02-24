# ---------------------------- #
# Etapa 1: Base com Node.js e Chromium
FROM node:20.13.1-alpine AS base

# Instalação do Chromium e dependências necessárias
RUN apk update && apk add --no-cache \
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

# Variáveis de ambiente para o Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

# Copia apenas os arquivos de dependências para aproveitar o cache no Docker
COPY package*.json ./

# Instalação das dependências de produção
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

# Ajustes de permissões e diretórios temporários para melhor performance do Puppeteer
RUN mkdir -p /app /tmp /app/.cache && chmod -R 777 /app /tmp /app/.cache

# Melhora a performance do Chromium ao usar memória compartilhada
VOLUME /dev/shm

# Exposição da porta para a aplicação
EXPOSE ${PORT}

# Comando para iniciar a aplicação
CMD ["npm", "start"]
