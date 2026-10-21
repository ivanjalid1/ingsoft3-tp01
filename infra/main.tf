# --- Secretos: los genera Terraform, nadie los escribe ni los copia ---------
# Quedan en el estado (por eso el estado no se versiona) y llegan a los
# contenedores por referencia. Son estables: un segundo apply no los cambia.

resource "random_password" "db_root" {
  length  = 32
  special = false
}

resource "random_password" "db_app" {
  length  = 32
  special = false
}

resource "random_password" "jwt" {
  length  = 48
  special = false
}

locals {
  db_name = "erp" # init.sql hace CREATE DATABASE erp / USE erp
  db_user = "erp_user"
  labels  = { "tp8.entorno" = "preprod", "tp8.gestionado-por" = "terraform" }
}

# --- Red y volumen propios: preprod no comparte nada con QA ni PROD --------

resource "docker_network" "preprod" {
  name = "tp8-preprod"
}

resource "docker_volume" "db_data" {
  name = "tp8-preprod-db-data"

  # Ejercicio §3.5: descomentar y `terraform destroy` se niega. Preprod tiene
  # que poder morir, por eso queda comentado.
  # lifecycle {
  #   prevent_destroy = true
  # }
}

# --- Imágenes: las mismas que verificó y publicó el pipeline del TP7 -------

resource "docker_image" "mysql" {
  name         = "mysql:8"
  keep_locally = true
}

resource "docker_image" "backend" {
  name         = "${var.image_repo_backend}:sha-${var.image_sha}"
  keep_locally = true
}

resource "docker_image" "frontend" {
  name         = "${var.image_repo_frontend}:sha-${var.image_sha}"
  keep_locally = true
}

# --- Base de datos ---------------------------------------------------------

resource "docker_container" "db" {
  name    = "tp8-preprod-db"
  image   = docker_image.mysql.image_id
  restart = "unless-stopped"

  env = [
    "MYSQL_ROOT_PASSWORD=${random_password.db_root.result}",
    "MYSQL_DATABASE=${local.db_name}",
    "MYSQL_USER=${local.db_user}",
    "MYSQL_PASSWORD=${random_password.db_app.result}",
  ]

  # El esquema sale del MISMO init.sql del repo (no de una copia): MySQL lo
  # corre una sola vez, con el volumen vacío. Terraform crea la base vacía;
  # el esquema lo pone este script.
  upload {
    file    = "/docker-entrypoint-initdb.d/init.sql"
    content = file("${path.module}/../tp2/backend/db/init.sql")
  }

  volumes {
    volume_name    = docker_volume.db_data.name
    container_path = "/var/lib/mysql"
  }

  networks_advanced {
    name = docker_network.preprod.name
  }

  # "Arrancó ≠ está listo": con wait = true el apply espera a que el
  # healthcheck dé healthy antes de crear el backend (en compose era
  # condition: service_healthy).
  healthcheck {
    test         = ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -p\"$MYSQL_ROOT_PASSWORD\" --silent"]
    interval     = "5s"
    timeout      = "5s"
    retries      = 12
    start_period = "1m0s"
  }
  wait         = true
  wait_timeout = 180

  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

# --- Backend ---------------------------------------------------------------

resource "docker_container" "backend" {
  name    = "tp8-preprod-backend"
  image   = docker_image.backend.image_id
  restart = "unless-stopped"

  # La conexión se DERIVA: host = nombre del contenedor de la base (DNS de la
  # red de Docker), contraseña = la que generó random_password. Nadie la copia.
  env = [
    "DB_HOST=${docker_container.db.name}",
    "DB_PORT=3306",
    "DB_USER=${local.db_user}",
    "DB_PASSWORD=${random_password.db_app.result}",
    "DB_NAME=${local.db_name}",
    "JWT_SECRET=${random_password.jwt.result}",
    "PORT=3000",
    # Lo que devuelve /api/health. Mismo contrato que deploy/compose.yml: la
    # versión es el sha de la imagen que corre.
    "APP_VERSION=${var.image_sha}",
  ]

  networks_advanced {
    name = docker_network.preprod.name
  }

  healthcheck {
    test         = ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
    interval     = "5s"
    timeout      = "5s"
    retries      = 12
    start_period = "20s"
  }
  wait         = true
  wait_timeout = 120

  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

# --- Frontend --------------------------------------------------------------

resource "docker_container" "frontend" {
  name    = "tp8-preprod-frontend"
  image   = docker_image.frontend.image_id
  restart = "unless-stopped"

  env = [
    # La dirección del backend se DERIVA del recurso, no se escribe a mano.
    "BACKEND_URL=http://${docker_container.backend.name}:3000",
    "DNS_RESOLVER=127.0.0.11",
  ]

  networks_advanced {
    name = docker_network.preprod.name
  }

  # Sólo loopback. La base y el backend no publican ningún puerto: se
  # alcanzan sólo por la red interna de preprod.
  ports {
    internal = 80
    external = var.front_port
    ip       = "127.0.0.1"
  }

  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}
