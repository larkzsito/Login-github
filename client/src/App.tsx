// Importa hooks de React para estado, ciclo de vida y eventos del formulario.
import { FormEvent, useState, useEffect } from 'react';
// Importa iconos SVG para los botones de correo y proveedores sociales.
import { Mail, Github, Facebook, Apple, Eye, EyeOff } from 'lucide-react';

// URL base de la API, configurable por variable de entorno o por defecto al backend local.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Define los tipos posibles de pantalla: login o registro.
type Mode = 'login' | 'register';

// Define la forma de la respuesta que puede devolver la API.
type ApiResponse = { message?: string; error?: string; user?: { id: string; email: string } };

// Componente principal que dibuja el login y administra sus interacciones.
export default function App() {
  // Guarda si estamos en login o registro.
  const [mode, setMode] = useState<Mode>('login');
  // Guarda el correo escrito por el usuario.
  const [email, setEmail] = useState('');
  // Guarda la contraseña escrita por el usuario.
  const [password, setPassword] = useState('');
  // Controla si la contraseña se ve o aparece oculta.
  const [showPassword, setShowPassword] = useState(false);
  // Guarda mensajes de éxito o error para mostrarlos en la interfaz.
  const [message, setMessage] = useState('');
  // Evita que se envíe el formulario repetidamente mientras espera al servidor.
  const [loading, setLoading] = useState(false);
  // Guarda el usuario autenticado después de comprobar la sesión.
  const [signedInEmail, setSignedInEmail] = useState('');

  // Verifica si ya existe una sesión activa al cargar la aplicación.
  useEffect(() => {
    async function checkCurrentSession() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/me`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data: ApiResponse = await response.json();
          if (data.user?.email) {
            setSignedInEmail(data.user.email);
          }
        }
      } catch {
        // Si el backend no está disponible al iniciar, se mantiene en la vista de login.
      }
    }
    checkCurrentSession();
  }, []);

  // Envía los datos al backend y muestra la respuesta del registro o login.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Evita que el navegador recargue la página al enviar el formulario.
    event.preventDefault();
    // Limpia el mensaje anterior para mostrar el resultado nuevo.
    setMessage('');
    // Activa el estado de carga del botón.
    setLoading(true);

    try {
      // Escoge la ruta adecuada según el modo actual.
      const endpoint = mode === 'login' ? '/api/login' : '/api/register';
      // Envía JSON al backend y permite que el navegador incluya la cookie de sesión.
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      // Convierte la respuesta JSON del servidor en un objeto JavaScript.
      const data: ApiResponse = await response.json();

      // Si el servidor respondió con un error HTTP, muestra el mensaje recibido.
      if (!response.ok) {
        setMessage(data.error || 'No se pudo completar la operación.');
        return;
      }

      // Si el registro fue exitoso, cambia al login para iniciar sesión.
      if (mode === 'register') {
        setMessage(data.message || 'Cuenta creada. Ya puedes iniciar sesión.');
        setMode('login');
        setPassword('');
      } else {
        // Si el login fue exitoso, muestra el estado autenticado.
        setSignedInEmail(data.user?.email || email);
        setMessage(data.message || 'Sesión iniciada.');
      }
    } catch {
      // Muestra un error si el servidor está apagado o no hay conexión.
      setMessage('No se pudo conectar con el servidor. Comprueba que esté iniciado.');
    } finally {
      // Desactiva el estado de carga incluso si ocurrió un error.
      setLoading(false);
    }
  }

  // Solicita cerrar la sesión en el servidor y actualiza la interfaz.
  async function handleLogout() {
    try {
      // Envía la petición que destruye la sesión del usuario.
      const response = await fetch(`${API_BASE_URL}/api/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      // Si el servidor confirma el cierre, limpia el usuario local.
      if (response.ok) {
        setSignedInEmail('');
        setMessage('Has cerrado sesión.');
      } else {
        setMessage('No se pudo cerrar la sesión.');
      }
    } catch {
      // Informa de problemas de conexión durante el cierre de sesión.
      setMessage('No se pudo conectar con el servidor.');
    }
  }

  // Muestra una tarjeta de sesión cuando las credenciales se validaron correctamente.
  if (signedInEmail) {
    return (
      <main className="page">
        <section className="login-card success-card">
          <h1>You're signed in</h1>
          <p className="subtitle">{signedInEmail}</p>
          <p className="notice" role="status">{message}</p>
          <button className="primary-button" onClick={handleLogout}>Log out</button>
        </section>
      </main>
    );
  }

  // Dibuja el formulario de login o registro según el modo seleccionado.
  return (
    <main className="page">
      <section className="login-card">
        {/* Título que cambia según la pantalla elegida. */}
        <h1>{mode === 'login' ? 'Sign In' : 'Sign Up'}</h1>

        {/* Texto de ayuda que aparece debajo del título. */}
        <p className="subtitle">
          {mode === 'login'
            ? 'Enter your email below to login to your account'
            : 'Create an account with your email and password'}
        </p>

        {/* El evento onSubmit llama a handleSubmit al enviar el formulario. */}
        <form onSubmit={handleSubmit}>
          {/* Etiqueta asociada al campo email para accesibilidad. */}
          <label htmlFor="email">Email</label>
          {/* Campo de correo controlado por el estado email. */}
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="m@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            maxLength={254}
          />

          {/* Fila que contiene la etiqueta Password y el enlace de recuperación. */}
          <div className="password-heading">
            <label htmlFor="password">Password</label>
            {mode === 'login' && (
              <button
                type="button"
                className="text-link"
                onClick={() => setMessage('La recuperación requiere configurar un proveedor de correo y tokens de un solo uso en el backend.')}
              >
                Forgot your password?
              </button>
            )}
          </div>

          {/* Contenedor que permite poner el botón de mostrar contraseña dentro del campo. */}
          <div className="password-wrap">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={mode === 'register' ? 8 : undefined}
              maxLength={72}
              required
            />
            {/* Cambia entre contraseña visible y oculta sin enviar el formulario. */}
            <button
              className="show-password"
              type="button"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Botón principal: envía el formulario a la API. */}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>

        {/* Botón visual de Magic Link: informa que necesita correo configurado. */}
        <button
          className="magic-button"
          type="button"
          onClick={() => setMessage('Magic Link necesita configurar el envío de correo y tokens de un solo uso en el backend.')}
        >
          <Mail size={18} strokeWidth={2} />
          <span>Sign in with Magic Link</span>
        </button>

        {/* Accesos sociales: no simulan una autenticación que aún no está configurada. */}
        <div className="social-grid" aria-label="Social sign in">
          <button type="button" aria-label="Sign in with GitHub" onClick={() => setMessage('Para activar GitHub debes configurar OAuth y su URL de callback.')}><Github /></button>
          <button type="button" aria-label="Sign in with Google" onClick={() => setMessage('Para activar Google debes configurar OAuth y su URL de callback.')}><span className="google-g">G</span></button>
          <button type="button" aria-label="Sign in with Facebook" onClick={() => setMessage('Para activar Facebook debes configurar OAuth y su URL de callback.')}><Facebook fill="currentColor" /></button>
          <button type="button" aria-label="Sign in with Apple" onClick={() => setMessage('Para activar Apple debes configurar Sign in with Apple.')}><Apple fill="currentColor" /></button>
        </div>

        {/* Región accesible donde se presentan errores y avisos de estado. */}
        {message && <p className="notice" role="status">{message}</p>}

        {/* Enlace inferior que alterna entre login y registro. */}
        <p className="signup-prompt">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="inline-link"
            type="button"
            onClick={() => {
              // Cambia de modo, borra el mensaje y limpia la contraseña.
              setMode(mode === 'login' ? 'register' : 'login');
              setMessage('');
              setPassword('');
            }}
          >
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </section>
    </main>
  );
}
