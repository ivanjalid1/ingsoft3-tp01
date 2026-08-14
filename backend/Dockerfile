FROM node:20-alpine

WORKDIR /app

# 1) Primero solo los manifiestos
COPY package*.json ./

# 2) Instalar dependencias de producción
RUN npm ci --omit=dev

# 3) Recién ahora el código
COPY src/ ./src/

EXPOSE 3000

CMD ["node", "src/server.js"]
