# 📊 Sistema de Gestión y Evaluación de Pósteres Académicos

Plataforma integral web para la recepción, organización espacial, asignación por comités, evaluación multicriterio por rondas independientes y premiación de pósteres académicos universitarios, con soporte multi-evento simultáneo (ej. Ingeniería de Sistemas e Ingeniería Civil).

---

## 🏗️ 1. Arquitectura del Sistema

* **Frontend:** Single Page Application (SPA) desarrollada en **React 19 + Vite**, componentes con TailwindCSS / CSS3 y soporte responsive para dispositivos móviles y quioscos táctiles.
* **Backend:** API REST desarrollada en **PHP 8.1+** modular estructurada en `/backend/api/` con capa de helpers de negocio y autenticación JWT / HMAC.
* **Base de Datos:** Relacional **MySQL 8.0+ / MariaDB 10.6+** con codificación `utf8mb4`.
* **Almacenamiento de Archivos:** Almacenamiento local seguro en `/backend/imgPosters/` con validación MIME, límites de peso y hashes anti-duplicados SHA-256.
* **Notificaciones y Automatización:** Notificaciones internas en tiempo real y correos transaccionales vía **SMTP** mediante PHPMailer y tareas programadas en segundo plano (`backend/tareas/Recordatorios.php`).

---

## 💻 2. Requerimientos de Infraestructura y Servidor

### Requerimientos de Hardware
| Recurso | Mínimo (Pruebas / Demo) | Recomendado (Producción Universitaria) |
| :--- | :--- | :--- |
| **CPU** | 2 vCPU | 4 vCPU |
| **Memoria RAM** | 2 GB a 4 GB | 8 GB |
| **Almacenamiento** | 20 GB SSD | 50 GB a 80 GB SSD (según volumen de pósteres en alta resolución) |
| **Arquitectura** | x86_64 / amd64 | x86_64 / amd64 |

### Requisitos de Software
1. **Sistema Operativo:** Linux (Ubuntu Server 22.04 LTS / 24.04 LTS o Debian 12 recomendado).
2. **Servidor Web:** **Nginx** (recomendado para SPA + proxy FastCGI a PHP-FPM) o **Apache 2.4** con módulos `mod_rewrite`, `mod_headers` y `php-fpm`.
3. **PHP:** Versión **8.1, 8.2 o 8.3** con las siguientes extensiones activas:
   * `php-mysqli` / `php-mysql`
   * `php-mbstring`
   * `php-json`
   * `php-openssl`
   * `php-curl`
   * `php-cli`
4. **Base de Datos:** MySQL 8.0+ o MariaDB 10.6+.
5. **Node.js:** Versión 18.x o 20.x LTS y `npm` (para compilar los assets del frontend).
6. **Composer:** Para la gestión de dependencias PHP (`phpmailer/phpmailer`).

### Ajustes Sugeridos en `php.ini`
```ini
upload_max_filesize = 30M
post_max_size = 35M
memory_limit = 256M
max_execution_time = 120
```

---

## 🚀 3. Guía Paso a Paso para el Despliegue

### Paso 1: Clonar el Repositorio
```bash
cd /var/www/
git clone https://github.com/jhank-beats/app-posters.git
cd app-posters
```

### Paso 2: Configurar la Base de Datos
1. Iniciar sesión en MariaDB/MySQL y crear la base de datos:
   ```sql
   CREATE DATABASE posters CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'posters_user'@'localhost' IDENTIFIED BY 'TuPasswordSeguro123';
   GRANT ALL PRIVILEGES ON posters.* TO 'posters_user'@'localhost';
   FLUSH PRIVILEGES;
   ```
2. Importar la estructura inicial y migraciones:
   ```bash
   mysql -u posters_user -p posters < BD/migracion_rondas.sql
   mysql -u posters_user -p posters < BD/migracion_fase1_rondas.sql
   mysql -u posters_user -p posters < BD/migracion_fase2_posters.sql
   mysql -u posters_user -p posters < BD/migracion_fase4_notificaciones.sql
   mysql -u posters_user -p posters < BD/migracion_fase5_recordatorios.sql
   mysql -u posters_user -p posters < BD/migracion_fase6_eventos_roles.sql
   ```
   *(Opcional para ambiente de pruebas/demo con 5 usuarios y configuración limpia)*:
   ```bash
   mysql -u posters_user -p posters < BD/reset_demo.sql
   ```

### Paso 3: Configurar Permisos y Directorio de Archivos
El servidor web debe tener permisos de escritura sobre la carpeta de almacenamiento de pósteres:
```bash
sudo chown -R www-data:www-data backend/imgPosters/
sudo chmod -R 775 backend/imgPosters/
```

### Paso 4: Variables de Entorno (Producción)
En el servidor o en la configuración del pool de PHP-FPM (`/etc/php/8.x/fpm/pool.d/www.conf`) configure las variables de entorno de conexión y seguridad:

```ini
env[DB_HOST] = "localhost"
env[DB_NAME] = "posters"
env[DB_USER] = "posters_user"
env[DB_PASS] = "TuPasswordSeguro123"
env[AUTH_SECRET] = "clave_secreta_super_aleatoria_de_mas_de_32_caracteres"
```

### Paso 5: Compilar el Frontend (React + Vite)
Instalar paquetes de Node.js y generar la versión optimizada de producción:
```bash
npm install
npm run build
```
Esto generará los archivos finales en la carpeta `dist/`.

---

## 🌐 4. Configuración del Servidor Web (Nginx Ejemplo)

Cree el archivo de configuración en `/etc/nginx/sites-available/posters.conf`:

```nginx
server {
    listen 80;
    server_name posters.tudominio.edu.co;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name posters.tudominio.edu.co;

    ssl_certificate /etc/letsencrypt/live/posters.tudominio.edu.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/posters.tudominio.edu.co/privkey.pem;

    root /var/www/app-posters/dist;
    index index.html;

    client_max_body_size 35M;

    # Frontend SPA: redirección de rutas al index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Backend en PHP
    location /api/ {
        alias /var/www/app-posters/backend/api/;
        try_files $uri $uri/ @apiphp;

        location ~ \.php$ {
            include snippets/fastcgi-php.conf;
            fastcgi_param SCRIPT_FILENAME $request_filename;
            fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
            include fastcgi_params;
        }
    }

    # Acceso a los archivos de pósteres
    location /backend/imgPosters/ {
        alias /var/www/app-posters/backend/imgPosters/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    location @apiphp {
        rewrite /api/(.*)$ /api/$1.php last;
    }
}
```

---

## ⏱️ 5. Tareas Programadas (Cron Job para Recordatorios)

Para la ejecución automática de los recordatorios de evaluación configurados por los administradores, configure la siguiente tarea en el crontab del sistema (`sudo crontab -e`):

```cron
# Ejecutar verificación de recordatorios cada 5 minutos
*/5 * * * * /usr/bin/php /var/www/app-posters/backend/tareas/Recordatorios.php > /dev/null 2>&1
```

---

## 👥 6. Usuarios Iniciales de Demostración

| Rol | Correo | Contraseña | Carrera / Ámbito |
|---|---|---|---|
| **Super Admin** | `camilo.murillo@campusucc.edu.co` | `demo1234` | Global (Todos los eventos) |
| **Admin** | `valentina.torres@campusucc.edu.co` | `demo1234` | Ingeniería de Sistemas *(Evento 1)* |
| **Admin** | `civil.admin@campusucc.edu.co` | `demo1234` | Ingeniería Civil *(Evento 3)* |
| **Usuario** | `sofia.herrera@campusucc.edu.co` | `demo1234` | Ingeniería de Sistemas *(Evento 1)* |
| **Usuario** | `juan.murillo@campusucc.edu.co` | `demo1234` | Ingeniería Civil *(Evento 3)* |

---

## 🔒 7. Red y Seguridad

1. **Puertos Abiertos:**
   * `80/TCP` (HTTP) y `443/TCP` (HTTPS) para tráfico web general.
   * `22/TCP` (SSH) con autenticación por llave para administración remota.
2. **Salida Saliente (Outbound):**
   * Puerto `587` o `465` TCP abierto para envío SMTP institucional.
3. **Certificados:**
   * Se requiere certificado SSL/TLS activo (soporte Let's Encrypt mediante `certbot`).
