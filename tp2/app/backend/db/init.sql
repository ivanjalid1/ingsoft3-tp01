-- ============================================================
-- ERP mínimo — esquema inicial
-- MySQL lo ejecuta automáticamente en el PRIMER arranque del
-- contenedor, por estar montado en /docker-entrypoint-initdb.d/
-- ============================================================

CREATE DATABASE IF NOT EXISTS erp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE erp;

-- ------------------------------------------------------------
-- usuarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(60)  NOT NULL,           -- bcrypt = exactamente 60 chars
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- clientes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  nombre   VARCHAR(150) NOT NULL,
  email    VARCHAR(150) NOT NULL UNIQUE,
  telefono VARCHAR(30)  NULL,
  activo   BOOLEAN      NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- productos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150)   NOT NULL,
  precio DECIMAL(10,2)  NOT NULL,
  stock  INT            NOT NULL DEFAULT 0,
  activo BOOLEAN        NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- ventas (cabecera)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT           NOT NULL,
  fecha      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  estado     ENUM('pendiente','anulada') NOT NULL DEFAULT 'pendiente',
  CONSTRAINT fk_ventas_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- venta_items (detalle)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venta_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  venta_id        INT           NOT NULL,
  producto_id     INT           NOT NULL,
  cantidad        INT           NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,  -- congelado al momento de la venta
  subtotal        DECIMAL(10,2) NOT NULL,  -- cantidad * precio_unitario
  CONSTRAINT fk_items_venta
    FOREIGN KEY (venta_id) REFERENCES ventas(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_items_producto
    FOREIGN KEY (producto_id) REFERENCES productos(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_items_venta ON venta_items (venta_id);
CREATE INDEX idx_ventas_cliente ON ventas (cliente_id);

-- ============================================================
-- Semilla: usuario admin
-- ------------------------------------------------------------
-- El hash de abajo corresponde a la contraseña 'Admin123!' con
-- bcrypt cost 10, generado con la librería `bcryptjs` (no el
-- módulo nativo `bcrypt`: ver decisión en decisiones.md de la
-- Tarea 12). bcryptjs implementa el mismo algoritmo bcrypt y
-- usa salt aleatorio, así que CADA máquina genera un hash
-- distinto y todos son válidos — el formato ($2a$/$2b$) y el
-- cost son interoperables entre ambas librerías.
--
-- Generá el tuyo y pegalo acá antes del primer `docker compose up`:
--   node -e "console.log(require('bcryptjs').hashSync('Admin123!',10))"
--
-- Verificá que quedó bien:
--   node -e "console.log(require('bcryptjs').compareSync('Admin123!','<hash>'))"
-- ============================================================
INSERT INTO usuarios (email, password_hash) VALUES
  ('admin@erp.local', '$2b$10$2VQCRePbZzKDgugLir44pOZPJfxobzhr2AjqQzoNDVh7fWB9uP/dy')
ON DUPLICATE KEY UPDATE email = email;

-- Datos de prueba mínimos (útiles para la demo y el e2e del TP6)
INSERT INTO clientes (nombre, email, telefono) VALUES
  ('Cliente Demo', 'demo@cliente.local', '3510000000')
ON DUPLICATE KEY UPDATE email = email;

INSERT INTO productos (nombre, precio, stock) VALUES
  ('Teclado',  15000.00, 20),
  ('Monitor',  180000.00, 5);
