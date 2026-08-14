import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import App from './App.jsx';

// Fuentes empaquetadas localmente (npm), no vía <link> a Google Fonts: la
// app tiene que arrancar sin internet dentro del contenedor. Solo se traen
// los pesos que se usan (400 regular, 500 medium, 600 semibold) y solo el
// subset "latin" (cubre español: acentos, ñ, etc.) en vez de las ~10
// variantes de alfabeto que trae cada peso por defecto (cirílico, griego,
// vietnamita...), que nunca se van a usar en este proyecto.
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './estilos.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
