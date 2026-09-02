import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Variables de entorno SOLO para los tests. No apuntan a ninguna base real:
    // la capa models/ está mockeada, así que nadie abre una conexión.
    env: {
      DB_HOST: 'localhost',
      DB_PORT: '3306',
      DB_USER: 'test',
      DB_PASSWORD: 'test',
      DB_NAME: 'erp_test',
      JWT_SECRET: 'secreto-de-test',
      PORT: '3000'
    }
  }
});
