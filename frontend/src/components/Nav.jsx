import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Solo linkea a rutas que existen al terminar esta tarea (Tarea 8).
// Los links a /clientes, /ventas/nueva y /ventas los agregan las Tareas 9 y 10
// cuando creen esas rutas — hasta entonces, linkear a algo inexistente se lee
// como un bug, no como una pantalla pendiente.
export default function Nav() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function manejarLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="nav">
      <NavLink to="/productos">Productos</NavLink>
      <span className="nav__usuario">{usuario?.email}</span>
      <button type="button" onClick={manejarLogout}>Salir</button>
    </nav>
  );
}
