// Importa Express para crear rutas HTTP y gestionar peticiones.
import express from 'express';
// Importa Helmet para añadir cabeceras HTTP de seguridad.
import helmet from 'helmet';
// Importa el limitador para frenar intentos repetidos de autenticación.
import rateLimit from 'express-rate-limit';
// Importa bcrypt para guardar contraseñas como hashes, no como texto plano.
import bcrypt from 'bcrypt';
// Importa el cliente MySQL que permite ejecutar consultas parametrizadas.
import mysql from 'mysql2/promise';
// Importa dotenv para cargar la configuración privada desde .env.
import 'dotenv/config';
// Importa sesiones para mantener autenticado al usuario entre peticiones.
import session from 'express-session';
// Importa el almacén de sesiones basado en MySQL.
import MySQLStoreFactory from 'express-mysql-session';

// Crea la aplicación Express.
const app = express();

// Comprueba que exista el secreto de sesiones antes de iniciar el servidor.
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('Configura SESSION_SECRET con al menos 32 caracteres en .env');
}

// Crea un pool de conexiones MySQL para reutilizar conexiones entre peticiones.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
});

// Crea el almacén de sesiones que guarda las sesiones en la base de datos.
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({}, pool);

// Añade cabeceras de seguridad HTTP.
app.use(helmet());

// Permite leer cuerpos JSON y limita su tamaño para evitar peticiones enormes.
app.use(express.json({ limit: '10kb' }));

// Permite peticiones desde el frontend y aceptar cookies.
// En producción, CLIENT_ORIGIN debe contener el dominio exacto del frontend.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CLIENT_ORIGIN || 'http://localhost:5173');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Configura sesiones del lado del servidor.
// En producción HTTPS, secure debe ser true; en desarrollo local HTTP usamos false.
app.use(session({
  name: 'login.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // JavaScript del navegador no puede leer la cookie.
    secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción.
    sameSite: 'lax', // Ayuda a reducir ciertos ataques CSRF.
    maxAge: 1000 * 60 * 60 * 2, // La cookie dura dos horas.
  },
}));

// Limita las peticiones de registro/login por IP: máximo 10 cada 15 minutos.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

// Crea la tabla de usuarios si aún no existe.
// El email tiene índice único para impedir cuentas duplicadas.
async function initializeDatabase() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

// Registra una cuenta nueva después de validar los campos y generar el hash.
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    // Extrae los datos del cuerpo; el frontend no se considera una barrera de seguridad.
    const { email, password } = req.body ?? {};

    // Comprueba los tipos y límites antes de procesar los datos.
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      email.trim().length < 5 ||
      email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      Buffer.byteLength(password, 'utf8') < 8 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({ error: 'Introduce un correo válido y una contraseña de 8 a 72 bytes.' });
    }

    // Normaliza el correo para que el registro y el login utilicen el mismo formato.
    const normalizedEmail = email.trim().toLowerCase();

    // Genera un hash bcrypt con coste 12; nunca guarda la contraseña original.
    const passwordHash = await bcrypt.hash(password, 12);

    // Inserta con placeholders ?; MySQL trata el valor como dato, no como SQL.
    await pool.execute(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [normalizedEmail, passwordHash]
    );

    // Responde 201 porque la cuenta fue creada.
    return res.status(201).json({ message: 'Cuenta creada. Ya puedes iniciar sesión.' });
  } catch (error) {
    // El código ER_DUP_ENTRY indica que el correo ya existe.
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'No se pudo crear la cuenta con esos datos.' });
    }

    // Registra detalles solo en el servidor; no envía el error interno al navegador.
    console.error('Error de registro:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Verifica el correo y la contraseña y, si coinciden, crea una sesión.
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    // Extrae los datos enviados por el formulario.
    const { email, password } = req.body ?? {};

    // Rechaza datos con tipos incorrectos o longitudes excesivas.
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      email.trim().length > 254 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({ error: 'Datos inválidos.' });
    }

    // Busca el usuario mediante una consulta parametrizada para evitar SQL injection.
    const [rows] = await pool.execute(
      'SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()]
    );

    // Selecciona el primer resultado; será undefined si el correo no existe.
    const user = rows[0];

    // Verifica el hash si existe el usuario. La respuesta es genérica para no revelar
    // si una dirección de correo está registrada.
    const passwordIsValid = user
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    if (!user || !passwordIsValid) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    // Regenera el ID de sesión después de autenticar para reducir riesgo de fijación.
    req.session.regenerate((sessionError) => {
      if (sessionError) {
        console.error('Error al regenerar sesión:', sessionError.message);
        return res.status(500).json({ error: 'No se pudo iniciar la sesión.' });
      }

      // Guarda únicamente el ID del usuario en la sesión del servidor.
      req.session.userId = String(user.id);

      // Guarda la sesión antes de responder para que esté disponible inmediatamente.
      req.session.save((saveError) => {
        if (saveError) {
          console.error('Error al guardar sesión:', saveError.message);
          return res.status(500).json({ error: 'No se pudo guardar la sesión.' });
        }

        // Devuelve datos públicos; nunca devuelve password_hash.
        return res.json({ message: 'Sesión iniciada.', user: { id: String(user.id), email: user.email } });
      });
    });
  } catch (error) {
    // Registra el error interno y devuelve un mensaje seguro al cliente.
    console.error('Error de login:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Devuelve el usuario asociado a la sesión actual, si está autenticado.
app.get('/api/me', async (req, res) => {
  try {
    // Si no hay ID de usuario en la sesión, no existe una sesión autenticada.
    if (!req.session.userId) {
      return res.status(401).json({ error: 'No has iniciado sesión.' });
    }

    // Busca solo los datos públicos del usuario con un parámetro SQL.
    const [rows] = await pool.execute(
      'SELECT id, email, created_at FROM users WHERE id = ? LIMIT 1',
      [req.session.userId]
    );

    // Si la cuenta ya no existe, invalida el acceso.
    if (!rows[0]) {
      return req.session.destroy(() => res.status(401).json({ error: 'Sesión inválida.' }));
    }

    // Devuelve información pública de la cuenta.
    return res.json({ user: { id: String(rows[0].id), email: rows[0].email, createdAt: rows[0].created_at } });
  } catch (error) {
    // Maneja fallos inesperados al consultar la sesión o la base de datos.
    console.error('Error al consultar sesión:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Cierra la sesión en el servidor y elimina la cookie del navegador.
app.post('/api/logout', (req, res) => {
  req.session.destroy((error) => {
    // Si no se pudo destruir la sesión, informa del fallo.
    if (error) return res.status(500).json({ error: 'No se pudo cerrar la sesión.' });

    // Elimina la cookie de sesión del navegador.
    res.clearCookie('login.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    // Confirma el cierre de sesión.
    return res.json({ message: 'Sesión cerrada.' });
  });
});

// Comprueba la conexión, crea la tabla y después empieza a escuchar peticiones.
async function startServer() {
  await initializeDatabase();
  await pool.query('SELECT 1');
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`API lista en http://localhost:${port}`));
}

// Inicia el servidor y finaliza con un error claro si la configuración falla.
startServer().catch((error) => {
  console.error('No se pudo iniciar el servidor:', error.message);
  process.exit(1);
});
