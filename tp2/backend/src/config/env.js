import 'dotenv/config';

// Las siete variables que el backend necesita para arrancar. Sin defaults:
// si falta una, es mejor morir acá que fallar en la primera request.
export const REQUERIDAS = [
  'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD',
  'DB_NAME', 'JWT_SECRET', 'PORT'
];

// Función pura: recibe el objeto de variables y devuelve las que faltan.
// Está separada del chequeo de abajo justamente para poder testearla
// sin matar el proceso de test.
export function faltantesDeEnv(fuente) {
  return REQUERIDAS.filter((clave) => !fuente[clave]);
}

const faltantes = faltantesDeEnv(process.env);

if (faltantes.length > 0) {
  console.error(
    `[config] Faltan variables de entorno obligatorias: ${faltantes.join(', ')}.\n` +
    `[config] Copiá .env.example a .env y completalas, o pasalas desde docker-compose.`
  );
  process.exit(1);
}

export const env = {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: Number(process.env.DB_PORT),
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  JWT_SECRET: process.env.JWT_SECRET,
  PORT: Number(process.env.PORT)
};
