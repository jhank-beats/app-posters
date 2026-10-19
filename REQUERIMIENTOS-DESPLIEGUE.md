# Ficha Técnica de Requerimientos para Despliegue — Sistema de Pósteres

Este documento especifica los requisitos técnicos de infraestructura, hardware, software, red y herramientas necesarias para el aprovisionamiento y despliegue del aplicativo en los servidores institucionales.

---

## 1. Resumen de la Arquitectura de la Aplicación

* **Frontend:** Single Page Application (SPA) desarrollada en **React 19 + Vite**, servida como archivos estáticos optimizados (`HTML`, `CSS`, `JS`).
* **Backend:** API REST desarrollada en **PHP** ubicada en `/backend/api`.
* **Base de Datos:** Relacional **MySQL / MariaDB**.
* **Almacenamiento de Archivos:** Almacenamiento local en disco en el servidor para pósteres e imágenes (`/backend/imgPosters/`).
* **Notificaciones por Correo:** Envío transaccional vía **SMTP** mediante PHPMailer (procesamiento asíncrono en segundo plano mediante `exec php`).

---

## 2. Requerimientos de Hardware

| Recurso | Mínimo (Pruebas / Tráfico bajo) | Recomendado (Producción Universitaria) |
| :--- | :--- | :--- |
| **CPU** | 2 vCPU | 4 vCPU |
| **Memoria RAM** | 2 GB a 4 GB | 8 GB |
| **Almacenamiento** | 20 GB SSD | 50 GB a 80 GB SSD (según el volumen de pósteres en alta resolución) |
| **Arquitectura** | x86_64 / amd64 | x86_64 / amd64 |

---

## 3. Requerimientos de Sistema Operativo y Servidor Web

* **Sistema Operativo:** Linux (distribución recomendada: **Ubuntu Server 22.04 LTS o 24.04 LTS**, o Debian 12).
* **Servidor Web:** 
  * **Nginx** (Recomendado por su alto rendimiento para servir la SPA y actuar como proxy inverso / FastCGI hacia PHP-FPM).
  * *Alternativa:* **Apache 2.4** con módulos `mod_rewrite`, `mod_headers` y `php-fpm`.

---

## 4. Software, Herramientas y Paquetes Requeridos

### A. Backend & PHP
* **PHP:** Versión **8.1, 8.2 o 8.3**.
* **Extensiones PHP requeridas:**
  * `php-mysqli` o `php-mysql` (conexión a la base de datos).
  * `php-mbstring` y `php-json` (soporte de cadenas UTF-8 y payloads JSON).
  * `php-openssl` (comunicación segura TLS con el servidor SMTP).
  * `php-curl` (peticiones HTTP salientes si se requieren).
  * `php-cli` (indispensable: el sistema ejecuta scripts en segundo plano vía CLI: `php EnviarCorreoFondo.php`).
* **Ajustes sugeridos en `php.ini`:**
  * `upload_max_filesize = 25M` (o superior, según el peso de los archivos de pósteres).
  * `post_max_size = 30M`.
  * `memory_limit = 256M`.

### B. Base de Datos
* **MySQL 8.0+** o **MariaDB 10.6+**.
* **Juego de caracteres predeterminado:** `utf8mb4` con collation `utf8mb4_unicode_ci`.

### C. Herramientas de Gestión y Despliegue
* **Composer:** Para instalar/actualizar dependencias de PHP (`phpmailer/phpmailer`).
* **Node.js (v18.x o v20.x LTS) & npm:** Para compilar el frontend (`npm run build`) en caso de realizar la construcción directamente en el servidor. *(Nota: también es factible compilar en local y subir únicamente el directorio `dist/`)*.
* **Git:** Para control de versiones y despliegue del repositorio en el servidor.

---

## 5. Red, Conectividad y Seguridad

1. **Puertos de Red:**
   * **80 (HTTP)** y **443 (HTTPS):** Abiertos para acceso de usuarios y evaluadores.
   * **22 (SSH):** Acceso restringido para labores de despliegue, administración y mantenimiento.
   * **Salida saliente (Outbound) a puerto 587 o 465 (SMTP):** Permitido para el envío de correos de notificación hacia el servidor SMTP configurado (Gmail o el servidor institucional de la universidad).
2. **Dominio / Subdominio:**
   * Asignación de un nombre de dominio o subdominio institucional (ej. `posters.ucc.edu.co` o IP fija institucional).
3. **Certificado SSL/TLS:**
   * Certificado HTTPS activo (Let's Encrypt o certificado wildcard institucional).

---

## 6. Permisos de Archivos y Almacenamiento

El aplicativo almacena archivos subidos por los usuarios en el servidor:
* El directorio `backend/imgPosters/` debe tener permisos de lectura y escritura para el usuario del servidor web (`www-data` en Ubuntu/Debian):
  ```bash
  sudo chown -R www-data:www-data backend/imgPosters/
  sudo chmod -R 775 backend/imgPosters/
  ```

---

## 7. Variables de Entorno para Producción

En el servidor (o en la configuración del servicio web / PHP-FPM) se deben definir las siguientes variables de entorno:

| Variable | Descripción | Ejemplo / Valor |
| :--- | :--- | :--- |
| `DB_HOST` | Host del servidor de base de datos | `localhost` o IP del servidor BD |
| `DB_NAME` | Nombre de la base de datos | `posters` |
| `DB_USER` | Usuario con permisos en la BD | `usuario_posters` |
| `DB_PASS` | Contraseña del usuario de la BD | *(contraseña segura)* |
| `AUTH_SECRET` | Clave secreta para la firma de tokens HMAC | *(cadena aleatoria de 32+ caracteres)* |
| `VITE_API_BASE` | URL base pública de la API consumida por el frontend | `https://posters.ucc.edu.co/api` |

---

## 8. Plantilla de Solicitud para el Evaluador / Departamento de TI

```text
Asunto: Requerimientos de infraestructura y servidor para despliegue - Sistema de Pósteres

Estimado(a) [Nombre del Profesor / Ingeniero de TI]:

Con el fin de proceder con el despliegue del aplicativo web del proyecto de grado, a continuación detallo los requerimientos técnicos necesarios para el aprovisionamiento del servidor o máquina virtual:

1. Tipo de servidor: Máquina virtual o servidor dedicado con Linux (Ubuntu Server 22.04/24.04 LTS o Debian 12).
2. Recursos sugeridos: 2 a 4 vCPU, 4 a 8 GB de RAM y 30 a 50 GB de almacenamiento SSD.
3. Servicios y software base:
   - Servidor Web: Nginx o Apache 2.4 con soporte HTTPS.
   - Motor de Base de Datos: MySQL 8.0 o MariaDB 10.6+ con soporte utf8mb4.
   - Intérprete: PHP 8.1+ con extensiones mysqli, mbstring, openssl, json, curl y cli.
   - Gestores: Composer y Git.
4. Comunicaciones y Red:
   - Asignación de subdominio o IP institucional.
   - Puertos abiertos para tráfico web: 80 y 443 (con certificado SSL).
   - Permiso de salida por el puerto 587/465 para notificaciones por correo electrónico (SMTP).
   - Acceso por SSH para realizar el despliegue y configuración inicial.

Quedo atento a cualquier inquietud técnica adicional.
```
