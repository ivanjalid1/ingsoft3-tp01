# ============================================================================
# TP8 · Infraestructura como Código — plan C (Terraform + provider Docker).
#
# Declara un entorno NUEVO, "preprod", que no existe hasta que se aplica:
# red, volumen, MySQL, backend y frontend con la imagen del TP7. Corre en el
# Docker de la máquina que aplica (local). QA y PROD (VPS, compose del TP6)
# no se declaran, no se importan y no se tocan.
#
# Providers FIJADOS por versión exacta: si no, un `terraform init` futuro baja
# otra y el archivo que hoy anda deja de compilar. El .terraform.lock.hcl
# (commiteado) fija además los hashes.
# ============================================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "4.6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.9.1"
    }
  }

  # Sin bloque backend: el estado queda en infra/terraform.tfstate, en la
  # máquina del que aplica (y en el .gitignore). Ver decisiones.md, TP8.
}

provider "docker" {
  # Sin credenciales: sólo dónde está el daemon. Por defecto el pipe de Docker
  # Desktop en Windows; en Linux/macOS: -var docker_host=unix:///var/run/docker.sock
  host = var.docker_host
}
