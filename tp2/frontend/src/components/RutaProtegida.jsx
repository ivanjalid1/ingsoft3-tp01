import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RutaProtegida({ children }) {
  const { token } = useAuth();

  if (!token) {
    // replace: el /productos al que no pudo entrar no queda en el historial,
    // así el botón "atrás" del navegador no lo devuelve al mismo rebote.
    return <Navigate to="/login" replace />;
  }

  return children;
}
