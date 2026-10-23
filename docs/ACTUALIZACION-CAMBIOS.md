# Cómo integrar los cambios nuevos — personal del servidor

**Última actualización de este documento:** rama `main` (commit `ef42b1e` o superior).  
Guía completa de despliegue desde cero: [`docs/COMO-DESPLEGAR-CON-SERVIDOR.md`](COMO-DESPLEGAR-CON-SERVIDOR.md).

---

## Qué cambió respecto a la versión anterior

### Código de la aplicación (git)

| Área | Cambio |
|------|--------|
| **Numeración de espacios** | El número `#N` de un póster es **continuo por evento** (no reinicia en cada piso). Ya no depende de esquema nuevo: solo SQL en backend. |
| **Espacios físicos** | El admin/superadmin puede **crear, editar y eliminar** espacios desde la UI (modal secundario). Si un espacio tiene pósters, al eliminarlos quedan **sin ubicación** (a reubicar). |
| **Conflicto de intereses** | El **autor** y los **profesores del póster** **no** pueden ser evaluadores ni calificarlo (automático y manual). Si no hay evaluadores disponibles, el póster queda **sin asignación** y se avisa al usuario. |
| **Plantilla de póster** | Home: descarga del **PPTX** oficial (Bienal 2026) + vista previa PNG. |
| **Correo** | Al encolar se intenta enviar **de inmediato**; el cron sigue como respaldo. |
| **UI** | Categorías con tildes; botón “Publicar nuevo póster” con tamaño correcto en desktop y móvil. |

### Base de datos (si no se aplicó antes)

En la BD de la aplicación, ejecutar **una sola vez** (son idempotentes / seguras):

```bash
mysql -u USUARIO -p NOMBRE_BD < BD/migracion_ruta_archivo.sql
mysql -u USUARIO -p NOMBRE_BD < BD/migracion_cola_correos.sql
```

| Archivo | Para qué |
|---------|----------|
| `BD/migracion_ruta_archivo.sql` | Guarda solo la clave del archivo de cada póster + índice de listado |
| `BD/migracion_cola_correos.sql` | Tabla `cola_correos` (avisos por correo) |

**No hace falta** migración extra solo por “numeración continua” ni por “conflicto de intereses”: no cambian tablas.

No importes dumps con datos personales. Si es entorno de prueba, solo `BD/reset_demo.sql`.

---

## Pasos (orden recomendado)

1. **Backup** de la BD (y de `/srv/posters-uploads` si aplica).
2. **Actualizar código:**
   ```bash
   cd /ruta/app-posters
   git fetch origin
   git reset --hard origin/main
   ```
3. **SQL** (si no se ejecutó en el paso de arriba): las dos migraciones.
4. **Frontend:**
   ```bash
   npm ci
   npm run build
   ```
5. **Entorno:** confirmar `backend/.env` o PHP-FPM (`AUTH_SECRET`, `DB_*`, `UPLOAD_DIR`, `CORS_ORIGINS`, `SMTP_*` si usan correo).
6. **Cron de correos** (si aplica) — ver §2.3 de `COMO-DESPLEGAR-CON-SERVIDOR.md`.
7. **Reiniciar PHP-FPM** si se cambiaron `env[...]` en el pool:
   ```bash
   sudo systemctl restart php8.x-fpm   # versión que usen
   ```

---

## Qué verificar después

- [ ] Login de admin y de usuario.
- [ ] **Espacios:** crear uno, editarlo (nombre/capacidad), intentar bajar capacidad bajo la ocupación → debe fallar con mensaje.
- [ ] **Numeración:** asignar un póster al 2.º espacio del evento y confirmar que el número no vuelve a `#1`.
- [ ] **Conflicto:** intentar autoasignar al autor o a un profesor del póster como evaluador → debe rechazar.
- [ ] Subir un póster sin evaluadores disponibles → alerta de asignación manual (no inventa evaluador).
- [ ] Pósters: la categoría se ve **Programación** (con tilde).
- [ ] Home: botón de plantilla PPTX y previsualización actualizados (si ya se desplegó esa parte).
- [ ] Consola del navegador: **sin** llamadas a `:8000`.

---

## Archivos relevantes en el repo

- `docs/COMO-DESPLEGAR-CON-SERVIDOR.md` — despliegue completo (Nginx, env, cron).
- `docs/ACTUALIZACION-CAMBIOS.md` — este aviso de integración.
- `BD/migracion_ruta_archivo.sql`, `BD/migracion_cola_correos.sql` — SQL a ejecutar.
- `PLAN-CORRECCIONES.md` — detalle técnico de los cambios de numeración/espacios/conflicto (equipo de desarrollo).

---

Si algo falla tras el pull: revisar `git log -1`, que `dist/` se haya regenerado y las filas de `cola_correos` / `DESCRIBE` de las tablas nuevas. Dudas con la app → equipo de desarrollo del proyecto.
