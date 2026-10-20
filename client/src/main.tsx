// Importa StrictMode para detectar algunos problemas durante el desarrollo.
import { StrictMode } from 'react';
// Importa createRoot para montar React dentro del elemento #root del HTML.
import { createRoot } from 'react-dom/client';
// Importa los estilos globales del login.
import './styles.css';
// Importa el componente principal del formulario.
import App from './App';

// Busca el contenedor HTML y renderiza la aplicación React dentro de él.
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('No se encontró el elemento raíz (#root) en el documento HTML.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
