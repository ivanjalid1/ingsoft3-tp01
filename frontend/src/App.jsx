import { Routes, Route, Navigate } from 'react-router-dom';
import RutaProtegida from './components/RutaProtegida.jsx';
import Login from './pages/Login.jsx';
import Productos from './pages/Productos.jsx';
import Clientes from './pages/Clientes.jsx';

// Este componente NO trae el Router adentro: lo pone main.jsx (BrowserRouter)
// y los tests (MemoryRouter). Así se puede testear una ruta concreta sin
// tocar la URL del navegador.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/productos"
        element={<RutaProtegida><Productos /></RutaProtegida>}
      />
      <Route
        path="/clientes"
        element={<RutaProtegida><Clientes /></RutaProtegida>}
      />
      <Route path="*" element={<Navigate to="/productos" replace />} />
    </Routes>
  );
}
