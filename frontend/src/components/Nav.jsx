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

  function claseLink({ isActive }) {
    return isActive ? 'active' : undefined;
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__marca">
        <span className="sidebar__logo" aria-hidden="true">E</span>
        <div>
          <div className="sidebar__nombre">ERP mínimo</div>
          <span className="sidebar__slug">UCC 2026</span>
        </div>
      </div>

      <nav className="sidebar__nav">
        <NavLink to="/productos" className={claseLink}>Productos</NavLink>
        <NavLink to="/clientes" className={claseLink}>Clientes</NavLink>
        <NavLink to="/ventas/nueva" className={claseLink}>Nueva venta</NavLink>
        <NavLink to="/ventas" className={claseLink}>Ventas</NavLink>
      </nav>

      <div className="sidebar__footer">
        <span className="sidebar__usuario">{usuario?.email}</span>
        <button type="button" onClick={manejarLogout}>Salir</button>
      </div>
    </aside>
  );
}
