# Cómo probar en local

Requisitos: PHP 8.x con `mysqli` y `gd`, MySQL/MariaDB, Node 18/20.

## 1. Variables de entorno

Ya existe `backend/.env` (no se sube a git). Si lo borras, copia `.env.example` y completa:

```bash
cp .env.example backend/.env
```

En local usamos la BD `posters` con `root`/`admin123` (ajusta si cambia tu MySQL).
`AUTH_SECRET` es obligatorio: se genera con `openssl rand -hex 32`.

## 2. Base de datos

```bash
mysql -u root -p posters < BD/migracion_cola_correos.sql   # cola de correos
mysql -u root -p posters < BD/migracion_ruta_archivo.sql   # claves de archivo + índice
```

Usuarios de prueba (si usaste `BD/reset_demo.sql`): contraseña `demo1234`.

## 3. Arrancar

**Terminal A — API PHP** (docroot = `backend`, así `/api` e `/imgPosters` resuelven):

```bash
cd /home/jhank/Desktop/app-posters
php -S 0.0.0.0:8000 -t backend
```

**Terminal B — Frontend Vite:**

```bash
npm run dev
```

Abre http://localhost:5173

En desarrollo, `src/config.js` apunta a `http://localhost:8000/api` y
`http://localhost:8000/imgPosters` automáticamente.

## 4. Probar lo nuevo

1. Login / registro.
2. **Usuarios** (superadmin) → **Importar CSV** (usa la plantilla del diálogo).
3. **Cargar póster** → el campo de profesor es un **buscador**.
4. Estrecha la ventana o usa el modo móvil: verás **“Desliza →”** en las tablas.
5. **Ayuda:** http://localhost:5173/ayuda

## 5. Correo

En local no hay SMTP: los correos se **omiten** (no rompen la app). Para ver
envíos reales, configura `SMTP_*` en `backend/.env` o usa la cola (`cola_correos`).

## 6. Lint y build

```bash
npm run lint
npm run build
```
