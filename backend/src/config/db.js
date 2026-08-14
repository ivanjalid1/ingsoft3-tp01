import mysql from 'mysql2/promise';
import { env } from './env.js';

// createPool no abre ninguna conexión: las abre recién en la primera query.
// Por eso importar este archivo en los tests es inofensivo.
export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
