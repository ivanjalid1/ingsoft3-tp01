# infra/ — el entorno `preprod`, declarado (TP8)

Terraform + provider Docker (plan C de la guía). Declara un entorno **nuevo**
que no existe hasta que se aplica, con la imagen del TP7 (`v7.0.0`):

```
random_password ×3 ─┐
docker_network ─────┤
docker_volume ──────┼─> docker_container.db ─> docker_container.backend ─> docker_container.frontend
docker_image.mysql ─┘        (MySQL + init.sql)       (imagen sha-<v7>)         (127.0.0.1:3630)
                             docker_image.backend ─┘  docker_image.frontend ─┘
```

QA y PROD (en el VPS, `deploy/compose.yml` del TP6) **no se declaran acá**.
Preprod no comparte red, volumen ni puertos con ellos.

## Requisitos

- Terraform ≥ 1.5 (medido con 1.15.8) y Docker corriendo.
- Ninguna credencial: las imágenes son públicas y las contraseñas las genera
  Terraform (`random_password`). En Linux/macOS agregar
  `-var docker_host=unix:///var/run/docker.sock`.

## Ciclo (lo de la defensa)

```bash
cd infra
terraform init            # baja los providers fijados (lock commiteado)
terraform plan            # Plan: 11 to add, 0 to change, 0 to destroy
terraform apply           # ~1 min (MySQL tarda en estar healthy)
terraform output

curl http://localhost:3630/api/health      # {"status":"ok","version":"b463…"}
curl http://localhost:3630/api/health/db   # {"status":"ok","db":"ok"}  ← toca la base
# navegador: http://localhost:3630  (admin@erp.local / Admin123!, el seed de init.sql)

terraform plan            # No changes  (idempotencia)
terraform destroy         # 11 destroyed: front → backend → db → volumen/red
```

## Dónde vive el estado

`infra/terraform.tfstate`, en la máquina que aplica, cubierto por el
`.gitignore`. Tiene las contraseñas en texto plano (`random_password.*.result`).
Si se pierde con preprod vivo, Terraform deja de saber que esos contenedores
son suyos: el `apply` siguiente choca por nombre (`tp8-preprod-*` ya existe).
Se arregla con `terraform import` o borrando los contenedores a mano.
