# Smoke test manual — Sistema de Pósteres

Ejecutar en el **servidor final** después de cada despliegue. Marcar cada ítem.

## Preparación
- [ ] `AUTH_SECRET`, `DB_*`, `UPLOAD_DIR` definidos (ver `PENDIENTES-DESPLIEGUE.md` y `.env.example`)
- [ ] `php BD/migracion_cola_correos.sql` y `php BD/migracion_ruta_archivo.sql` aplicados
- [ ] PHP deshabilitado en la carpeta de uploads
- [ ] `npm run build` y deploy de `dist/`

## Recorrido
1. [ ] Login como **evaluador** y como **admin**
2. [ ] Registro + aprobación de usuario nuevo
3. [ ] Subir póster PDF y PNG (ok). Intentar subir `.php` → rechazado
4. [ ] Editar póster **propio** (ok). Editar póster **ajeno** con otro usuario → 403
5. [ ] Eliminar póster ajeno → 403
6. [ ] Asignar evaluador a un póster
7. [ ] Calificar con el evaluador (una vez; doble clic no duplica nota)
8. [ ] Cerrar ronda y pasar a la siguiente
9. [ ] Generar QR y **escanearlo con un móvil** en la WiFi del campus → abre el archivo
10. [ ] Varios logins seguidos desde la misma IP sin bloquearse entre sí
11. [ ] Revisar Network: las llamadas van a `/api/...` (sin `:8000` ni mixed content)
12. [ ] Correo de prueba (si SMTP está configurado) aparece en `cola_correos` y se envía

## Seguridad rápida
- [ ] `git grep -E 'buscar patrones de secretos conocidos'` no devuelve secretos
- [ ] No hay PDFs personales en `backend/imgPosters/`
- [ ] Sin `AUTH_SECRET` la API responde 500 (no emite tokens)
