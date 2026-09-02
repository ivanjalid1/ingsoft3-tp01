import { Routes, Route, Navigate } from 'react-router-dom';
import RutaProtegida from './components/RutaProtegida.jsx';
import Nav from './components/Nav.jsx';
import Login from './pages/Login.jsx';
import Productos from './pages/Productos.jsx';
import Clientes from './pages/Clientes.jsx';
import NuevaVenta from './pages/NuevaVenta.jsx';
import Ventas from './pages/Ventas.jsx';

// El shell visual (sidebar de 216px + topbar con breadcrumb + área de
// contenido) vive acá porque es la única pieza que todas las pantallas
// protegidas comparten. Es puro marcado: no toca RutaProtegida, no toca el
// token, no decide si se puede entrar o no — de eso se sigue encargando
// RutaProtegida exactamente igual que antes. /login queda afuera a propósito
// (pantalla centrada, sin sidebar).
function Shell({ titulo, children }) {
  return (
    <div className="app-shell">
      <Nav />
      <div className="app-shell__contenido">
        <header className="topbar">
          <span className="topbar__breadcrumb">
            ERP mínimo <strong>{titulo}</strong>
          </span>
        </header>
        <main className="contenedor">{children}</main>
      </div>
    </div>
  );
}

// Este componente NO trae el Router adentro: lo pone main.jsx (BrowserRouter)
// y los tests (MemoryRouter). Así se puede testear una ruta concreta sin
// tocar la URL del navegador.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/productos"
        element={<RutaProtegida><Shell titulo="Productos"><Productos /></Shell></RutaProtegida>}
      />
      <Route
        path="/clientes"
        element={<RutaProtegida><Shell titulo="Clientes"><Clientes /></Shell></RutaProtegida>}
      />
      <Route
        path="/ventas/nueva"
        element={<RutaProtegida><Shell titulo="Nueva venta"><NuevaVenta /></Shell></RutaProtegida>}
      />
      <Route
        path="/ventas"
        element={<RutaProtegida><Shell titulo="Ventas"><Ventas /></Shell></RutaProtegida>}
      />
      <Route path="*" element={<Navigate to="/productos" replace />} />
    </Routes>
  );
}
