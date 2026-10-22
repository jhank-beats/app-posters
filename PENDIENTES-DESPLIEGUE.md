# Pendientes de despliegue — Sistema de Pósteres

Acciones que dependen de datos externos o de decisiones del equipo. Completar **antes de abrir el evento**.

## 1. Rotación de secretos (URGENTE — ya expuestos en el repo público)

- [ ] **App password de Gmail** (`REMOVED_EMAIL`): revocar en la cuenta Google → https://myaccount.google.com/apppasswords. Crear una nueva **solo** si se va a seguir usando Gmail, y ponerla en `SMTP_PASS` (nunca en el código).
- [ ] **API key de Gemini** (estaba en `conf continue.txt`): rotar en Google AI Studio y no volver a subirla al repo.
- [ ] **Contraseñas de BD** que hayan usasen `REMOVED_PASS` / `1234` en el servidor: cambiarlas.
- [ ] **Repo GitHub**: ponerlo en privado **o** limpiar el historial (git filter-repo / BFG). Este plan no reescribe historial.

## 2. Variables de entorno obligatorias en el servidor

Definir en el entorno de PHP/Apache/Nginx (o `backend/.env`):

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DB_HOST` | sí | Host MySQL |
| `DB_NAME` | sí | Base de datos |
| `DB_USER` | sí | Usuario MySQL (nunca root en producción) |
| `DB_PASS` | sí | Contraseña MySQL |
| `AUTH_SECRET` | sí | Secreto HMAC de tokens. Sin él la app **no arranca** (500). Generar: `openssl rand -hex 32` |
| `UPLOAD_DIR` | sí (prod) | Ruta absoluta de pósters, **fuera** del checkout de git (ej. `/srv/posters-uploads`) |
| `CORS_ORIGINS` | sí (prod) | Origen(es) permitidos, separados por coma (ej. `https://posters.ucc.edu.co`) |
| `SMTP_HOST` | si se envía correo | Host SMTP |
| `SMTP_PORT` | no | Puerto (587 por defecto) |
| `SMTP_USER` | si se envía correo | Usuario SMTP |
| `SMTP_PASS` | si se envía correo | Contraseña / app password SMTP |
| `SMTP_FROM` | no | Remitente |
| `SMTP_FROM_NAME` | no | Nombre del remitente |
| `VITE_API_BASE` | no (build) | Por defecto relativo `/api`. Solo si el backend no está en el mismo origen |
| `VITE_FILES_BASE` | no (build) | Por defecto relativo `/imgPosters` |

## 3. SMTP institucional

- Dominio conocido: **campusucc.edu.co** (confirmado por el equipo de desarrollo).
- [ ] Solicitar a TI: host SMTP exacto (ej. `smtp.campusucc.edu.co`), puerto (587/465), usuario/cuenta de envío, contraseña o app password, remitente permitido y cuota diaria.
- [ ] Configurar `SMTP_*` solo en el servidor (nunca en el código).
- Mensión listo para reenviar: [`docs/SOLICITUD-TI-DOMINIO-SMTP.md`](docs/SOLICITUD-TI-DOMINIO-SMTP.md).

## 4. Dominio y URLs

- [ ] Pedir a TI/Redes el subdominio + HTTPS (ver mensaje en `docs/SOLICITUD-TI-DOMINIO-SMTP.md`).
- [ ] Configurar `CORS_ORIGINS` con ese origen.
- [ ] **No imprimir QR** hasta que el dominio esté fijo y se haya probado `/poster/:id`.
- [ ] Nginx: SPA con `try_files`, `/api/` → PHP-FPM, `/imgPosters/` → volumen de uploads con **PHP deshabilitado** (que un `.php` subido no se ejecute).
- [ ] En GitHub: **Settings → Danger Zone → Change visibility → Private**.

## 5. Servidor

- [ ] `UPLOAD_DIR` en volumen persistente con permisos para el usuario web (0755).
- [ ] PHP deshabilitado en la carpeta de uploads.
- [ ] Backup de uploads antes del evento (`scripts/backup-uploads.sh`).
- [ ] Cargar **solo** `BD/reset_demo.sql` (o esquema real), **nunca** dumps con datos personales.
- [ ] Confirmar si el servidor ve la IP individual de cada cliente o la IP NAT del campus (afina el rate limit).

## 6. Smoke test en el servidor final

1. Login (evaluador y admin).
2. Subir póster (PDF/PNG).
3. Asignar evaluador → calificar → cerrar ronda.
4. Escanear QR con un móvil en la WiFi del campus.
5. Varios logins seguidos desde la misma IP sin bloquearse entre sí.
