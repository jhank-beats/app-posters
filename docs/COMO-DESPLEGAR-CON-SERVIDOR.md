# Despliegue — Sistema de Pósteres (instrucciones para el servidor)

Este documento es para quien **administra el servidor** de la universidad.
El código de la app cambió tras una auditoría de seguridad. Después de actualizarlo es **obligatorio** configurar unas variables; si no, **no se puede iniciar sesión** (responde un error genérico a propósito).

Repositorio: `https://github.com/jhank-beats/app-posters` (rama `main`)

---

## 1. Actualizar el código

El historial de git se limpió por secretos. Si el servidor tiene un clone/copia antigua:

```bash
# Preferible: clonar de nuevo en un directorio nuevo y dejarlo como raíz
cd /var/www
mv app-posters app-posters.bak   # solo si ya existe
git clone https://github.com/jhank-beats/app-posters.git
```

O si usan `git pull` en una copia **del mismo remote** (origin = el de arriba):

```bash
cd /var/www/app-posters
git fetch origin
git reset --hard origin/main
```

Si el servidor usa un **fork u otro remote**, avisar antes de forzar nada; se puede reemplazar la carpeta de aplicación con la descarga de `main`.

### Artefactos

- **Frontend:** usar la carpeta `dist/` del repo (o regenerar en un servidor de build: `npm ci && npm run build`).
- **Backend PHP:** `backend/` (incluye `vendor/` de PHPMailer).
- **SQL:** archivos en `BD/`.

---

## 2. Variables de entorno (OBLIGATORIO)

La app ya **no** trae contraseñas ni secretos por defecto en el código. Hay que proveer los valores reales.

### 2.1 Dónde definirlas

Elija **una** de las dos opciones.

**Opción A — archivo `backend/.env`**

Crear (o editar) el archivo en la raíz del backend, junto a `Conexion.php`:

```text
/var/www/app-posters/backend/.env
```

Ejemplo:

```ini
DB_HOST=localhost
DB_NAME=posters
DB_USER=posters_user
DB_PASS=********
AUTH_SECRET=********
UPLOAD_DIR=/srv/posters-uploads
PUBLIC_FILES_URL=/imgPosters
CORS_ORIGINS=https://posters.ejemplo.edu.co
```

Permisos sugeridos del archivo:

```bash
sudo chown www-data:www-data /var/www/app-posters/backend/.env
sudo chmod 640 /var/www/app-posters/backend/.env
```

**Opción B — PHP-FPM (sin archivo .env)**

En el pool (por ejemplo `/etc/php/8.x/fpm/pool.d/www.conf`), añadir:

```ini
env[DB_HOST] = "localhost"
env[DB_NAME] = "posters"
env[DB_USER] = "posters_user"
env[DB_PASS] = "********"
env[AUTH_SECRET] = "********"
env[UPLOAD_DIR] = "/srv/posters-uploads"
env[PUBLIC_FILES_URL] = "/imgPosters"
env[CORS_ORIGINS] = "https://posters.ejemplo.edu.co"
```

Reiniciar:

```bash
sudo systemctl restart php8.x-fpm
```

---

### 2.2 Significado de cada variable

| Variable | Qué es | Ejemplo / nota |
|----------|--------|----------------|
| `DB_HOST` | Servidor MySQL | `localhost` si está en la misma máquina |
| `DB_NAME` | Base de datos de la app | p. ej. `posters` |
| `DB_USER` | Usuario MySQL **de la app** (mejor no root) | el que ya usaba la BD |
| `DB_PASS` | Contraseña de ese usuario | |
| `AUTH_SECRET` | Secreto aleatorio para firmar tokens de sesión. **Sin él no hay login.** | generar con el comando del §3 |
| `UPLOAD_DIR` | Carpeta **absoluta** donde se guardan los pósters | `/srv/posters-uploads` |
| `PUBLIC_FILES_URL` | Prefijo público de esa carpeta | normalmente `/imgPosters` |
| `CORS_ORIGINS` | URL(s) desde la que el navegador puede llamar a la API (coma si hay varias) | `https://su-dominio.edu.co` |
### 2.3 Correo (SMTP) — necesario para que salgan avisos

Sin estas variables la app **no envía** correos (registra en log y continúa).

Ejemplo con Gmail (cuenta del evento):

```ini
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=correo_del_evento@gmail.com
SMTP_PASS=contraseña_de_aplicacion_de_16_caracteres
SMTP_FROM=correo_del_evento@gmail.com
SMTP_FROM_NAME=Sistema de Pósteres UCC
```

También en PHP-FPM:

```ini
env[SMTP_HOST] = "smtp.gmail.com"
env[SMTP_PORT] = "587"
env[SMTP_USER] = "..."
env[SMTP_PASS] = "..."
env[SMTP_FROM] = "..."
env[SMTP_FROM_NAME] = "Sistema de Pósteres UCC"
```

**Cron (respaldo de envío / reintentos):**

```bash
crontab -e
# Cada minuto drena la tabla cola_correos
* * * * * php /var/www/app-posters/backend/tareas/ColaCorreos.php >> /tmp/cola_posters.log 2>&1
```

Si `exec` está habilitado, el sistema **también intenta enviar al instante** al encolar; el cron es el respaldo.

**Comprobar en el servidor:**

```bash
# 1) Tabla existe
mysql -u posters_user -p posters -e "DESCRIBE cola_correos;"

# 2) Variables leídas (debe imprimir host/user; la pass no se imprime completa)
php -r 'require "/var/www/app-posters/backend/api/includes/Env.php";
echo app_env("SMTP_HOST"), " ", app_env("SMTP_USER"), " pass_len=", strlen((string)app_env("SMTP_PASS")), PHP_EOL;'

# 3) Drenar a mano
php /var/www/app-posters/backend/tareas/ColaCorreos.php

# 4) Ver estado
mysql -u posters_user -p posters -e "SELECT estado, COUNT(*) FROM cola_correos GROUP BY estado;"
```

Si `pass_len=0` → faltan variables. Si hay filas `pendiente` tras el drenador → mirar `ultimo_error` y el log de PHP (`error_log`).

---

## 3. Generar `AUTH_SECRET`

En el servidor:

```bash
openssl rand -hex 32
```

Copia la salida (64 caracteres hexadecimales) al valor de `AUTH_SECRET`.  
No la publique en repositorios ni en chats abiertos. Cada entorno puede usar la suya.

---

## 4. Carpeta de archivos subidos (pósters)

```bash
sudo mkdir -p /srv/posters-uploads
sudo chown -R www-data:www-data /srv/posters-uploads
sudo chmod 755 /srv/posters-uploads
```

`UPLOAD_DIR` debe ser exactamente esa ruta.

**Seguridad:** en esa carpeta **no debe ejecutarse PHP**; solo se sirven `pdf`, `jpg`, `jpeg`, `png`, `gif`, `webp`.  
En Nginx (ejemplo):

```nginx
location /imgPosters/ {
    alias /srv/posters-uploads/;
    location ~ \.php$ { deny all; }
    # types / expires a gusto
}
```

En Apache, existe un `.htaccess` en la carpeta de uploads del repo que deniega scripts; aun así conviene no permitir ejecución de PHP ahí a nivel de vhost.

---

## 5. Base de datos (migraciones nuevas)

Con un cliente MySQL, en la BD de la aplicación, importar (si aún no existen):

1. `BD/migracion_ruta_archivo.sql`
2. `BD/migracion_cola_correos.sql`

Ejemplo:

```bash
mysql -u posters_user -p posters < BD/migracion_ruta_archivo.sql
mysql -u posters_user -p posters < BD/migracion_cola_correos.sql
```

También se ejecutan las migraciones históricas de rondas/eventos/notificaciones si la BD está desactualizada (ver README §3).

**No importar** dumps con datos personales reales. Para demo usar solo `BD/reset_demo.sql`.

---

## 6. Frontend

Si la web estática es `dist/` de este repo, basta con que Nginx/Apache apunte a esa carpeta y use `try_files` hacia `index.html` (SPA).  
La app habla con la API en rutas relativas (`/api`, `/imgPosters`) por lo que frontend y backend deben quedar en **el mismo origen** (mismo dominio), o hay que ajustar `VITE_API_BASE` / `VITE_FILES_BASE` al compilar.

Ejemplo mínimo Nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name posters.su-dominio.edu.co;
    root /var/www/app-posters/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        alias /var/www/app-posters/backend/api/;
        try_files $uri $uri/ @apiphp;
        location ~ \.php$ {
            include snippets/fastcgi-php.conf;
            fastcgi_param SCRIPT_FILENAME $request_filename;
            fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        }
    }

    location @apiphp {
        rewrite /api/(.*)$ /api/$1.php last;
    }

    location /imgPosters/ {
        alias /srv/posters-uploads/;
        location ~ \.php$ { deny all; }
    }
}
```

Ajustar versión de PHP y ruta de `SCRIPT_FILENAME` según el servidor.

---

## 7. Comprobación rápida

1. Abrir la app: la página carga.
2. Login: si sale **“Error de configuración del servidor”** o 500 en la API → faltan variables (sobre todo `AUTH_SECRET` y `DB_*`).
3. Login correcto con un usuario de prueba.
4. Subir un PDF de prueba → aparece en `/srv/posters-uploads`.
5. Si usan correo: definir `SMTP_*` (§2.3), importar `cola_correos` y dejar el cron.
   Tras subir un póster, en la BD debe quedar fila `enviado` o `pendiente` con drenador en marcha.

---

## 8. Si algo falla

| Síntoma | Causa probable |
|---------|----------------|
| 500 / “Error de configuración del servidor” | No se leen `AUTH_SECRET`, `DB_*` |
| Login “Credenciales inválidas” siempre | Usuario/contraseña de la app mal, o usuario inactivo en BD |
| CSS/JS 404 o API 404 | `dist/` o el `location /api/` mal apuntados |
| Pósters no se ven | `UPLOAD_DIR` / `PUBLIC_FILES_URL` o alias `/imgPosters` mal |
| Origen rechazado en consola del navegador (CORS) | `CORS_ORIGINS` no coincide con la URL exacta (https, sin barra final) |

---

## 9. Contacto

Para dudas de **configuración del servidor**, responder a quien envió este repo.  
Pendientes de dominio/SMTP institucional: ver `PENDIENTES-DESPLIEGUE.md` y `docs/SOLICITUD-TI-DOMINIO-SMTP.md`.
