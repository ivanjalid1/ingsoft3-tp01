FROM node:20-alpine

# El contenedor NO corre como root. La imagen oficial ya trae el usuario `node`
# (uid 1000), así que no hace falta crear ninguno: alcanza con que /app sea suyo
# y con cambiar de usuario ANTES del `npm ci`, para que ni siquiera node_modules
# quede escrito por root. Si un día alguien escapa del proceso, no aterriza como
# root de la máquina — es la pregunta cantada del TP9 (DevSecOps).
RUN mkdir -p /app && chown node:node /app

WORKDIR /app
USER node

# 1) Primero solo los manifiestos
COPY --chown=node:node package*.json ./

# 2) Instalar dependencias de producción
RUN npm ci --omit=dev

# 3) Recién ahora el código
COPY --chown=node:node src/ ./src/

EXPOSE 3000

CMD ["node", "src/server.js"]
