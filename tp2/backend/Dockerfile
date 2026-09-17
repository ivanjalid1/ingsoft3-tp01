# ---------- Etapa 1: install (deps completas + tests) ----------
FROM node:20-alpine AS build

WORKDIR /app

# 1) Solo manifiestos para cachear la capa de dependencias
COPY package*.json ./

# 2) Instalar TODAS las dependencias (prod + dev) para poder correr tests
RUN npm ci

# 3) Copiar el código fuente y tests
COPY . .

# 4) Ejecutar tests — si fallan, la imagen no se construye
RUN npm test

# ---------- Etapa 2: tests con coverage (parte del build) ----------
FROM build AS test
ENTRYPOINT ["npm", "run", "test:ci"]

# ---------- Etapa 3: runtime (solo lo necesario) ----------
FROM node:20-alpine

# El contenedor NO corre como root. La imagen oficial ya trae el usuario `node`
# (uid 1000), así que no hace falta crear ninguno: alcanza con que /app sea suyo
# y con cambiar de usuario ANTES del `npm ci`, para que ni siquiera node_modules
# quede escrito por root. Si un día alguien escapa del proceso, no aterriza como
# root de la máquina — es la pregunta cantada del TP9 (DevSecOps).
RUN mkdir -p /app && chown node:node /app

WORKDIR /app
USER node

# 1) Solo manifiestos
COPY --chown=node:node package*.json ./

# 2) Instalar solo dependencias de producción (sin devDependencies)
RUN npm ci --omit=dev

# 3) Copiar solo el código fuente (sin tests, sin configs de dev)
COPY --chown=node:node src/ ./src/

EXPOSE 3000

CMD ["node", "src/server.js"]
