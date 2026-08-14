// Error de dominio: lleva el status HTTP y el code del contrato de error.
// Es lo único que los services lanzan a propósito; cualquier otra cosa
// que explote es un error no previsto y sale como 500.
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}
