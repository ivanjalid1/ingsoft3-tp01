# deploy/ — cómo se despliega el TP6 en el VPS

QA (`https://qa.testingwebapp.site`) y PROD (`https://prod.testingwebapp.site`)
corren en un VPS compartido (Ubuntu 24, nginx + certbot en el host), cada uno
como un proyecto de docker compose (`tp6-qa`, `tp6-prod`). Esta carpeta versiona
todo lo que hace falta para entender y reconstruir ese deploy. El porqué de cada
decisión está en [`decisiones.md`](../decisiones.md) (sección TP6).

| Archivo | Qué es |
|---|---|
| `compose.yml` | El stack (mysql + backend + frontend) por imagen `sha-<sha>`. `deploy.sh` lo baja **del mismo sha** que despliega. |
| `deploy.sh` | Copia (fuente de verdad documentada) del script del comando forzado, instalado a mano en `/opt/ingsoft3-tp6/deploy.sh`. |
| `.env.example` | Nombres de las variables del `.env` de cada entorno, con placeholders. |
| `authorized_keys.example` | Las dos líneas con forced command (keys reemplazadas por placeholders). |
| `nginx/*.conf` | Copias de los vhosts del host (las líneas SSL las maneja certbot). |

## Qué vive dónde

**a) Variables del repo (GitHub → Settings → Secrets and variables → Actions → Variables)**

- `VPS_HOST`: IP/host del VPS.
- `VPS_KNOWN_HOSTS`: la(s) línea(s) `known_hosts` del VPS (`ssh-keyscan -t ed25519 <host>`).

Son **variables y no secrets** porque no son información secreta: la IP es
pública y la host key la entrega el servidor a cualquiera que se conecte. Lo que
importa de `VPS_KNOWN_HOSTS` no es ocultarla sino **fijarla**: con
`StrictHostKeyChecking=yes` el job sólo se conecta si el servidor presenta esa
identidad, lo que evita un MITM (nada de "aceptar cualquier host").

**b) Secrets de environment: `DEPLOY_SSH_KEY` en `qa` y en `production`**

Mismo nombre, **keys distintas**. El job toma el secret del environment en el
que corre, así que el YAML es idéntico para QA y PROD, pero la key de QA sólo
existe para jobs del environment `qa`, y la de PROD sólo para `production` (que
además pide aprobación). Y en el VPS cada key sólo puede ejecutar su entorno.

**c) Archivos en el VPS**

| Ruta | Dueño / modo | En el repo |
|---|---|---|
| `/opt/ingsoft3-tp6/deploy.sh` | `root:root 755` | `deploy/deploy.sh` |
| `/opt/ingsoft3-tp6/{qa,prod}/` | `tp6deploy 750` | — (ahí quedan `compose.yml`, `init.sql` y `deploy.log`) |
| `/opt/ingsoft3-tp6/{qa,prod}/.env` | `tp6deploy 600` | sólo `deploy/.env.example` (**los valores nunca se versionan**) |
| `/home/tp6deploy/.ssh/authorized_keys` | `tp6deploy 600` | `deploy/authorized_keys.example` |
| `/etc/nginx/sites-available/{qa,prod}.testingwebapp.site.conf` | root | `deploy/nginx/` |

**d) Imágenes en ghcr.io (públicas)**

`ghcr.io/ivanjalid1/ingsoft3-tp01-{backend,frontend}:sha-<sha>` son paquetes
públicos y el VPS las baja **de forma anónima**: no hay `docker login` ni token
en el VPS. Si los paquetes pasaran a privados, el `compose pull` fallaría y
habría que agregar un token de sólo lectura (`read:packages`) en el VPS.

## El flujo

El YAML (`ci.yml` / `rollback.yml`, vía `.github/actions/deploy-vps`) decide
**cuándo**, **qué entorno** (por el environment de GitHub, que entrega la key) y
**qué sha**, y se conecta por SSH. El script del VPS hace el resto. El forced
command limita cada key a su entorno.

```
merge a main
  └─ CI: tests → build → push ghcr.io/...:sha-<sha>   (backend y frontend)
      └─ deploy-qa (environment qa, key de QA)
          └─ ssh tp6deploy@VPS_HOST "<sha>"
              └─ forced command: /opt/ingsoft3-tp6/deploy.sh qa
                  ├─ valida sha (40 hex)
                  ├─ baja compose.yml e init.sql de raw.githubusercontent.com/<sha>
                  ├─ IMAGE_TAG=<sha> docker compose -p tp6-qa pull
                  ├─ docker compose up -d --wait
                  └─ deploy.log: env=qa sha=<sha> exit=<rc>
          └─ smoke: /api/health (version == sha), /api/health/db, /
      └─ deploy-prod (environment production: aprobación) → igual con deploy.sh prod
```

**Rollback:** `.github/workflows/rollback.yml` (workflow_dispatch con el `sha`
de un deploy bueno). Es el mismo despliegue apuntando a una imagen anterior; no
revierte datos ni esquema.

## Riesgo de drift: el script del VPS no se actualiza solo

`deploy/deploy.sh` es la copia documentada, pero el VPS **no** la toma sola del
repo. Cada vez que cambie, hay que mergear y reinstalarla a mano:

```bash
scp deploy/deploy.sh root@VPS:/tmp/ &&   ssh root@VPS 'install -o root -g root -m 755 /tmp/deploy.sh /opt/ingsoft3-tp6/deploy.sh'
```

Para verificar que no divergieron: `sha256sum` de los dos lados tiene que dar
igual. `compose.yml` e `init.sql` no tienen este problema: se bajan del sha en
cada deploy, así que un rollback usa los del commit al que vuelve.

## Runner self-hosted en el VPS (desde TP7)

Los jobs que hablan con el VPS (`deploy-qa`, `integracion`, `e2e`,
`deploy-prod`, `rollback-prod`) corren con `runs-on: [self-hosted, tp6-vps]`.

**Por qué:** desde los runners de GitHub hubo 4 cortes (timeouts de SSH y de
HTTPS) en los que la IP del runner **no aparecía en ningún log del VPS**: los
paquetes se perdían antes de llegar (red de Azure ↔ Hostinger). Reintentar no
sirve porque el runner mantiene la misma IP todo el job. El runner self-hosted
abre él la conexión **saliente** a GitHub para pedir trabajos, así que la ruta
Azure → VPS deja de usarse. Los builds siguen en `ubuntu-latest`.

**Cómo está aislado:**

- Usuario propio `tp6runner`: **sin sudo y fuera del grupo `docker`**. No puede
  tocar contenedores; para desplegar hace lo mismo que antes, SSH a
  `tp6deploy@<vps>` con la key del environment, y el comando forzado sigue
  siendo la única puerta (cada key → un entorno, entrada = un sha).
- Repo público → riesgo de que un PR de un fork cambie el `runs-on` y ejecute
  código en el VPS. Mitigación: *Settings → Actions → Approval for running fork
  pull request workflows* = **todos los contribuidores externos** (ningún
  workflow de un fork corre sin que el dueño lo apruebe). Igual, ningún job de
  PR usa este runner.
- Las librerías de sistema de Chromium se instalaron una sola vez como root
  (`npx playwright install-deps chromium`); el job sólo baja el navegador.

**Instalación** (versión y token: `gh api repos/actions/runner/releases/latest`,
`gh api -X POST repos/<owner>/<repo>/actions/runners/registration-token`):

```bash
sudo useradd -m -s /bin/bash tp6runner
sudo -u tp6runner bash -c 'mkdir ~/actions-runner && cd ~/actions-runner &&
  curl -fsSL https://github.com/actions/runner/releases/download/v<ver>/actions-runner-linux-x64-<ver>.tar.gz | tar xz &&
  ./config.sh --unattended --url https://github.com/<owner>/<repo> --token <token>     --name tp6-vps --labels tp6-vps --no-default-labels'
cd /home/tp6runner/actions-runner && sudo ./svc.sh install tp6runner && sudo ./svc.sh start
sudo npx -y playwright@<versión-del-package.json> install-deps chromium
gh api -X PUT repos/<owner>/<repo>/actions/permissions/fork-pr-contributor-approval   -f approval_policy=all_external_contributors
```

Si el runner está caído, los jobs quedan en *Queued* (no fallan): revisar
`systemctl status actions.runner.*tp6-vps*`.

## Seguridad y alternativas

**Lo que esto no resuelve (dicho honestamente):** `tp6deploy` está en el grupo
`docker`, que en el host equivale a root: podría ver o parar los contenedores
de otros proyectos o montar `/` en un contenedor. La mitigación actual es el
comando forzado (cada key → un solo entorno, la única entrada es un sha). El
siguiente paso identificado, a propósito **no** hecho en este VPS compartido de
producción, es Docker *rootless* con un usuario por entorno (`tp6qa`,
`tp6prod`), para que una credencial filtrada no salga de su entorno; eso
también permitiría llevar la lógica al YAML del workflow sin una key sin
restricciones.

**Alternativas consideradas y descartadas:**

- **Todos los comandos en el YAML**, mandados por SSH: el deploy quedaría
  versionado con el commit, pero exige una key sin restricciones (una shell de
  un usuario ≈ root) en una máquina compartida; con la key de QA se podría tocar
  PROD. Con el forced command, cada key sólo sabe desplegar su entorno.
- **Un bootstrap fijo que baje `deploy.sh` del repo en cada sha**: resuelve el
  drift, pero agrega piezas (descarga, fallback para commits viejos que no
  tienen el script) a cambio de poco, para un script que casi nunca cambia.

## Setup desde cero en un VPS nuevo

Requisitos: Docker con el plugin compose, nginx, certbot (`python3-certbot-nginx`).

```bash
# 1. Usuario de deploy, sin contraseña, en el grupo docker
sudo adduser --disabled-password --gecos "" tp6deploy
sudo usermod -aG docker tp6deploy

# 2. Directorios
sudo install -d -o root -g root -m 755 /opt/ingsoft3-tp6
sudo install -d -o tp6deploy -g tp6deploy -m 750 /opt/ingsoft3-tp6/qa /opt/ingsoft3-tp6/prod

# 3. Un .env por entorno (partir de deploy/.env.example; FRONT_PORT 3610 qa / 3620 prod;
#    cada secreto con: openssl rand -hex 24, distintos entre QA y PROD)
sudo -u tp6deploy sh -c 'umask 077; cat > /opt/ingsoft3-tp6/qa/.env'     # pegar y Ctrl-D
sudo -u tp6deploy sh -c 'umask 077; cat > /opt/ingsoft3-tp6/prod/.env'

# 4. El script del comando forzado
sudo install -o root -g root -m 755 deploy/deploy.sh /opt/ingsoft3-tp6/deploy.sh

# 5. Dos keys (en una máquina local) y authorized_keys con forced command
ssh-keygen -t ed25519 -N "" -C tp6-deploy-qa   -f tp6_qa
ssh-keygen -t ed25519 -N "" -C tp6-deploy-prod -f tp6_prod
sudo install -d -o tp6deploy -g tp6deploy -m 700 /home/tp6deploy/.ssh
#   escribir /home/tp6deploy/.ssh/authorized_keys según deploy/authorized_keys.example
#   (tp6deploy:tp6deploy, chmod 600)

# 6. DNS: registros A  qa.testingwebapp.site y prod.testingwebapp.site → IP del VPS

# 7. vhosts + TLS (copiar deploy/nginx/*.conf SIN las líneas "managed by Certbot",
#    o sea sólo el server{} de :80 con el location /; certbot agrega el resto)
sudo cp qa.testingwebapp.site.conf prod.testingwebapp.site.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/qa.testingwebapp.site.conf   /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/prod.testingwebapp.site.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d qa.testingwebapp.site     # un certificado por dominio
sudo certbot --nginx -d prod.testingwebapp.site

# 8. GitHub (desde el repo, con gh)
gh variable set VPS_HOST --body "<ip-del-vps>"
ssh-keyscan -t ed25519 <ip-del-vps> | gh variable set VPS_KNOWN_HOSTS   # verificar el fingerprint por otro canal
gh secret set DEPLOY_SSH_KEY --env qa         < tp6_qa
gh secret set DEPLOY_SSH_KEY --env production < tp6_prod

# 9. Probar: ssh -i tp6_qa tp6deploy@<vps> ls   → debe salir con código 2 (no es un sha)
#    después, borrar las privadas locales tp6_qa / tp6_prod (ya están en GitHub)
```
