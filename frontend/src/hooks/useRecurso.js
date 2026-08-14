import { useCallback, useEffect, useState } from 'react';
import { get, post, put, del } from '../api/client.js';

// Las pantallas de Productos y Clientes hacen el mismo ciclo contra la API
// (cargar el listado, crear, editar, dar de baja, mostrar el último error),
// así que ese ciclo vive acá. Lo que NO vive acá es el formulario: cada
// pantalla conserva su propio JSX y su propia validación de campos —
// productos tiene precio/stock, clientes tiene email/teléfono, y unificar
// eso sería una abstracción que no vale lo que cuesta.
export function useRecurso(rutaBase) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setItems(await get(rutaBase));
    } catch (err) {
      setError(err.message);
    }
  }, [rutaBase]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(datos) {
    try {
      await post(rutaBase, datos);
      setError('');
      await cargar();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  async function actualizar(id, datos) {
    try {
      await put(`${rutaBase}/${id}`, datos);
      setError('');
      await cargar();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  async function darDeBaja(id) {
    try {
      await del(`${rutaBase}/${id}`);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return { items, error, setError, crear, actualizar, darDeBaja };
}
