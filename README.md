# Login visual + MySQL (comentado)

## Requisitos
- Node.js 20 o superior
- MySQL 8+
- Dos terminales para ejecutar cliente y servidor

## 1. Crear la base de datos
Ejecuta en MySQL Workbench o en la consola MySQL:

```sql
CREATE DATABASE login_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

La tabla se crea automáticamente al iniciar el servidor.

## 2. Configurar backend
```bash
cd server
npm install
```
Copia `.env.example` a `.env` y completa tus valores. Usa un secreto de sesión largo y aleatorio. No publiques `.env`.

```bash
npm run dev
```

El backend estará en http://localhost:3000.

## 3. Configurar frontend
En otra terminal:
```bash
cd client
npm install
npm run dev
```
Abre la URL que indique Vite, normalmente http://localhost:5173.

## Qué funciona
- Registro con correo y contraseña.
- Inicio de sesión con contraseña.
- Cierre de sesión.
- Endpoint de sesión actual.
- Consultas SQL parametrizadas (`?`) para prevenir inyección SQL.
- Hash de contraseña con bcrypt.
- Sesiones en MySQL y cookie HttpOnly.
- Limitación de intentos en registro/login.

## Qué requiere configuración adicional
- “Forgot your password?” necesita proveedor de correo y flujo de recuperación con token de un solo uso.
- “Sign in with Magic Link” necesita proveedor de correo y tokens temporales de un solo uso.
- GitHub, Google, Facebook y Apple necesitan credenciales OAuth de cada proveedor y configuración de callback. En esta plantilla muestran un aviso; no simulan un login real.

## Importante para producción
Este proyecto es una base de aprendizaje, no una auditoría de seguridad. En producción usa HTTPS, cambia todos los secretos, configura correctamente el proxy de confianza, añade protección CSRF para las operaciones que cambian estado, verificación de correo, recuperación segura de contraseña, logs sin secretos y límites de abuso adecuados. No uses la configuración de desarrollo sin revisarla.
