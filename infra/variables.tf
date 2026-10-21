# Nada de esto es secreto: una imagen pública, un commit, un puerto y dónde
# está Docker. Los secretos (contraseñas de la base, JWT) NO son variables:
# los genera random_password en main.tf y viajan sólo por el estado.

variable "docker_host" {
  description = "Daemon de Docker donde nace preprod."
  type        = string
  default     = "npipe:////./pipe/docker_engine"
}

variable "image_repo_backend" {
  description = "Imagen del backend publicada por el pipeline del TP7, SIN tag."
  type        = string
  default     = "ghcr.io/ivanjalid1/ingsoft3-tp01-backend"
}

variable "image_repo_frontend" {
  description = "Imagen del frontend publicada por el pipeline del TP7, SIN tag."
  type        = string
  default     = "ghcr.io/ivanjalid1/ingsoft3-tp01-frontend"
}

variable "image_sha" {
  description = "Commit (40 hex) cuya imagen corre preprod. Fijo a propósito: v7.0.0, lo que hoy corre PROD."
  type        = string
  default     = "b4630600d430e889a27473bec6cfd8674110b5a0"

  validation {
    condition     = can(regex("^[0-9a-f]{40}$", var.image_sha))
    error_message = "image_sha tiene que ser un sha completo de 40 caracteres hex (el pipeline sólo publica sha-<commit>)."
  }
}

variable "front_port" {
  description = "Puerto local del front de preprod. No choca con QA (3610) ni PROD (3620)."
  type        = number
  default     = 3630
}
