import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Linkea a todas las rutas protegidas que existen (Tareas 9 y 10): no queda
// ningún link pendiente en este árbol.
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
      <NavLink to="/clientes">Clientes</NavLink>
      <NavLink to="/ventas/nueva">Nueva venta</NavLink>
      <NavLink to="/ventas">Ventas</NavLink>
      <span className="nav__usuario">{usuario?.email}</span>
      <button type="button" onClick={manejarLogout}>Salir</button>
    </nav>
  );
}
