# Sólo lo que no es secreto. Las contraseñas no salen por output: viven en el
# estado y en el env de los contenedores.

output "front_url" {
  value = "http://localhost:${docker_container.frontend.ports[0].external}"
}

output "health_url" {
  value = "http://localhost:${docker_container.frontend.ports[0].external}/api/health"
}

output "health_db_url" {
  value = "http://localhost:${docker_container.frontend.ports[0].external}/api/health/db"
}

output "imagen_backend" {
  value = docker_image.backend.name
}
