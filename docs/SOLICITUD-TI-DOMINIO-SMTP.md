# Solicitud a TI / Redes — Sistema de Pósteres (evento)

> Mensión listo para copiar y reenviar.

---

Asunto: Solicitud de dominio y datos SMTP — Sistema de Pósteres (evento de pósters)

Estimado equipo de TI / Redes:

Necesitamos aprovisionamiento para el aplicativo web "Sistema de Pósteres"
(React + PHP + MySQL) con el que se gestionará el evento de pósters de la
Universidad Cooperativa de Colombia.

**1) DOMINIO / ACCESO**

- Un subdominio institucional con HTTPS (certificado válido).
  Preferido: `posters.campusucc.edu.co` (o el que indiquen ustedes).
- Debe llegar al servidor donde se despliegue la app (puertos 80/443).
- Si no hay subdominio disponible, se puede usar una IP fija con HTTPS,
  pero los QR impresos quedarían atados a esa IP.

**2) CORREO SMTP INSTITUCIONAL**

- Dominio que manejamos: `campusucc.edu.co`
- Necesitamos:
  - host SMTP exacto (ej. `smtp.campusucc.edu.co`),
  - puerto (587 STARTTLS o 465 SSL),
  - usuario/cuenta de envío,
  - contraseña o app password,
  - remitente permitido.
- Cuota diaria de envío (el evento generará avisos a evaluadores/participantes).

**3) BASE DE DATOS Y ALMACENAMIENTO**

- MySQL/MariaDB 8+ (utf8mb4) con usuario propio (no root).
- Volumen persistente para archivos de pósters (ej. `/srv/posters-uploads`),
  con respaldo; la carpeta NO debe ejecutar PHP.

**4) ENTORNO**

- Variables obligatorias (las definimos nosotros en el servidor):
  `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `AUTH_SECRET`, `UPLOAD_DIR`,
  `CORS_ORIGINS` (igual al dominio final) y `SMTP_*` cuando haya.

Quedo atento para coordinar el despliegue y la prueba de acceso.
