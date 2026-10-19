#!/usr/bin/env bash
# =====================================================================
# BD/demo_upload.sh — Carga DEMO de pósters por la API REAL
# =====================================================================
# QUÉ HACE:
#   Simula a DOS personas reales (los 2 usuarios) subiendo sus pósters
#   desde el formulario de la app. NO toca la BD directamente: usa el
#   mismo flujo HTTP que el navegador (login + POST multipart a
#   SubirPosters.php), con archivos reales.
#
#   Cada usuario sube 2 pósters  →  4 pósters en total.
#
# REQUISITOS:
#   * Backend corriendo:  cd backend && php -S 0.0.0.0:8000
#   * BD ya reseteada:    mysql -u root -p posters < BD/reset_demo.sql
#
# CÓMO USARLO:
#   bash BD/demo_upload.sh
# =====================================================================
set -e

API="http://localhost:8000/api"
IMG="backend/imgPosters"
TMP="/tmp/opencode/upload-demo"
mkdir -p "$TMP"

# ---------------------------------------------------------------
# login(correo) -> imprime "id_usuario|token"
# ---------------------------------------------------------------
login() {
  local correo="$1"
  curl -s -X POST "$API/InicioSesion.php" \
    -H "Content-Type: application/json" \
    -d "{\"correo\":\"$correo\",\"contrasena\":\"demo1234\"}" |
    php -r '$d=json_decode(stream_get_contents(STDIN),true); echo ($d["usuario"]["id"] ?? "ERROR") . "|" . ($d["token"] ?? "");'
}

# ---------------------------------------------------------------
# subir(sesion, archivo_origen, nombre_archivo, titulo, autores,
#       descripcion, categoria, palabras)
#   -> POST multipart idéntico al FormData del formulario
# ---------------------------------------------------------------
subir() {
  local sesion="$1" origen="$2" nombre="$3" titulo="$4" autores="$5"
  local desc="$6" cat="$7" palabras="$8"
  local id="${sesion%%|*}"
  local token="${sesion#*|}"

  cp "$origen" "$TMP/$nombre"

  local resp
  resp=$(curl -s -X POST "$API/SubirPosters.php" \
    -H "Authorization: Bearer $token" \
    -F "titulo=$titulo" \
    -F "autores=$autores" \
    -F "descripcion=$desc" \
    -F "categoria=$cat" \
    -F "palabrasClave=$palabras" \
    -F "archivo=@$TMP/$nombre" \
    -F "id_usuario=$id")

  local status
  status=$(echo "$resp" | php -r '$d=json_decode(stream_get_contents(STDIN),true); echo $d["status"] ?? "sin-respuesta";')
  printf "   [id=%s] %-45s -> %s\n" "$id" "$titulo" "$status"
  if [ "$status" != "success" ]; then
    echo "      ⚠ respuesta completa: $resp"
  fi
}

echo "======================================================"
echo " CARGA DEMO POR LA API REAL (SubirPosters.php)"
echo "======================================================"

echo ""
echo "▶ Login como SOFÍA (usuario real, id 4)…"
SES_SOFIA=$(login "sofia.herrera@campusucc.edu.co")
echo "   Sesión iniciada → id_usuario=${SES_SOFIA%%|*}"

echo ""
echo "▶ Sofía sube sus 2 pósters:"
subir "$SES_SOFIA" "$IMG/Sistema de Seguridad.pdf" "Sistema-Seguridad-Perimetral.pdf" \
  "Sistema de Seguridad Perimetral con Visión Artificial" \
  "Sofía Herrera, Camilo Muñoz" \
  "Prototipo de un sistema de vigilancia que detecta intrusos en tiempo real mediante visión artificial y notifica al responsable del espacio." \
  "backend" "seguridad, visión artificial, IoT"

subir "$SES_SOFIA" "$IMG/Nuevo modelo frontend.png" "Panel-Frontend-Servicios.png" \
  "Panel de Control Frontend para Servicios Públicos" \
  "Sofía Herrera, Valentina Torres" \
  "Interfaz web responsiva que centraliza la consulta y el pago de servicios públicos, con accesibilidad y modo móvil." \
  "frontend" "UI/UX, accesibilidad, responsive"

echo ""
echo "▶ Login como MATEO (usuario real, id 5)…"
SES_MATEO=$(login "mateo.rios@campusucc.edu.co")
echo "   Sesión iniciada → id_usuario=${SES_MATEO%%|*}"

echo ""
echo "▶ Mateo sube sus 2 pósters:"
subir "$SES_MATEO" "$IMG/VideoJuego Adaptativo.pdf" "Videojuego-Educativo-Adaptativo.pdf" \
  "Videojuego Educativo Adaptativo para Aprendizaje" \
  "Mateo Ríos, Diego Fernández" \
  "Juego serio que ajusta la dificultad según el desempeño del estudiante para reforzar conceptos de programación." \
  "programacion" "gamificación, educación, adaptativo"

subir "$SES_MATEO" "$IMG/Estadistica de pandemia.pdf" "Modelo-Prediccion-Pandemias.pdf" \
  "Modelo Estadístico de Predicción de Pandemias" \
  "Mateo Ríos, Sofía Herrera" \
  "Aplicación de series de tiempo y regresión para anticipar la propagación de enfermedades y apoyar la toma de decisiones." \
  "estadistica" "series de tiempo, regresión, salud pública"

echo ""
echo "======================================================"
echo " RESUMEN EN BD"
echo "======================================================"
mysql -u root -pREMOVED_PASS posters -e \
  "SELECT p.id, p.titulo, p.categoria, CONCAT(u.nombres,' ',u.apellidos) AS usuario, p.id_espacio
   FROM cargar_posters p LEFT JOIN usuario u ON u.id=p.id_usuario ORDER BY p.id;" 2>/dev/null
