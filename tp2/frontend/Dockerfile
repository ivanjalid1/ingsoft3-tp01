# ---------- Etapa 1: build ----------
FROM node:26-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build          # genera /app/dist

# ---------- Etapa 2: tests con coverage (parte del build) ----------
FROM build AS test
ENTRYPOINT ["npm", "run", "test:ci"]

# ---------- Etapa 3: runtime ----------
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
# Plantilla: el entrypoint de nginx:alpine la pasa por envsubst al arrancar y genera
# /etc/nginx/conf.d/default.conf. Los ENV son los valores por defecto (los del compose
# local); en el VPS se pisan desde el compose sin reconstruir la imagen.
COPY default.conf.template /etc/nginx/templates/default.conf.template
ENV BACKEND_URL=http://backend:3000 DNS_RESOLVER=127.0.0.11

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
