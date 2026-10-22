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
echo "▶ Login como SOFÍA (Ingeniería de Sistemas, id=10)…"
SES_SOFIA=$(login "sofia.herrera@campusucc.edu.co")
echo "   Sesión iniciada → id_usuario=${SES_SOFIA%%|*}"

echo ""
echo "▶ Sofía sube sus 2 pósters (Ingeniería de Sistemas):"
subir "$SES_SOFIA" "$IMG/Sistema de Seguridad.pdf" "Sistema-Seguridad-Perimetral.pdf" \
  "Arquitectura de Microservicios Resilientes en Kubernetes" \
  "Sofía Herrera López, Camilo Moncaleano" \
  "Diseño e implementación de una malla de servicios con tolerancia a fallos y autoescalado predictivo." \
  "backend" "kubernetes, microservicios, resiliencia"

subir "$SES_SOFIA" "$IMG/Nuevo modelo frontend.png" "Panel-Frontend-Servicios.png" \
  "Detección Temprana de Intrusiones en Redes Campus con Deep Learning" \
  "Sofía Herrera López, Valentina Torres" \
  "Modelo neuronal recurrente entrenado sobre tráfico de red para identificar anomalías en tiempo real." \
  "programacion" "ciberseguridad, deep learning, redes"

echo ""
echo "▶ Login como JUAN CAMILO (Ingeniería Civil, id=30)…"
SES_JUAN=$(login "juan.murillo@campusucc.edu.co")
echo "   Sesión iniciada → id_usuario=${SES_JUAN%%|*}"

echo ""
echo "▶ Juan Camilo sube sus 2 pósters (Ingeniería Civil):"
subir "$SES_JUAN" "$IMG/violin-key-gb819f8b04_640.png" "Hormigon-Autoreparable.png" \
  "Hormigón Autoreparable con Bacterias Calcificantes en Clima Tropical" \
  "Juan Camilo Murillo Rojas, Carlos Mendoza" \
  "Evaluación experimental de resistencia a compresión y sellado de fisuras con Bacillus subtilis." \
  "calculo" "hormigón, materiales, biotecnología civil"

subir "$SES_JUAN" "$IMG/Nuevo modelo frontend.png" "Vulnerabilidad-Sismica.png" \
  "Análisis de Vulnerabilidad Sísmica en Edificaciones Patrimoniales de Mampostería" \
  "Juan Camilo Murillo Rojas, Camilo Moncaleano" \
  "Modelación por elementos finitos de estructuras históricas bajo espectros de diseño NSR-10." \
  "calculo" "nsr-10, mampostería, vulnerabilidad sísmica"


echo ""
echo "======================================================"
echo " RESUMEN EN BD"
echo "======================================================"
mysql -u posters_user -p posters -e \
  "SELECT p.id, p.titulo, p.categoria, CONCAT(u.nombres,' ',u.apellidos) AS usuario, p.id_espacio
   FROM cargar_posters p LEFT JOIN usuario u ON u.id=p.id_usuario ORDER BY p.id;" 2>/dev/null
