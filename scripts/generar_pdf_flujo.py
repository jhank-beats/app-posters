import sys
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

# 1. GENERAR IMAGEN DEL DIAGRAMA DE FLUJO
def generar_diagrama_flujo(output_png):
    fig, ax = plt.subplots(figsize=(10, 6), dpi=220)
    ax.axis('off')
    
    # Pasos del flujo
    pasos = [
        ("1. CONFIGURACIÓN", "Eventos, Espacios continuos\ny Criterios Ronda 1", "#132740"),
        ("2. REGISTRO Y ROLES", "Inscripción, aprobación\ny asignación Evaluadores", "#00acc9"),
        ("3. CARGA DE PÓSTERES", "Ubicación física continua y\nEvaluador R1 automático", "#0093ad"),
        ("4. EVALUACIÓN R1", "Calificación por criterios\n(Control de conflicto interés)", "#2b7a78"),
        ("5. CORTE RONDA 1", "Cierre de ronda y pase de\nlos N mejores clasificados", "#80ba27"),
        ("6. RONDA 2 (FINAL)", "Reasignación de evaluadores\ny evaluación Gran Final", "#cad400"),
        ("7. PODIO Y PREMIOS", "Cierre R2 y selección de\n1°, 2° y 3° lugar", "#e67e22"),
        ("8. CERTIFICADOS", "Descarga de constancias y\ndiplomas institucionales", "#27ae60"),
    ]
    
    # Coordenadas en 2 filas x 4 columnas
    coords = [
        (0.05, 0.58), (0.28, 0.58), (0.51, 0.58), (0.74, 0.58),
        (0.74, 0.12), (0.51, 0.12), (0.28, 0.12), (0.05, 0.12)
    ]
    
    w, h = 0.20, 0.32
    
    for i, ((tit, desc, col), (x, y)) in enumerate(zip(pasos, coords)):
        # Caja con bordes redondeados
        box = patches.FancyBboxPatch(
            (x, y), w, h,
            boxstyle="round,pad=0.015,rounding_size=0.03",
            facecolor=col, edgecolor="#ffffff", linewidth=1.5
        )
        ax.add_patch(box)
        
        # Textos
        ax.text(x + w/2, y + h*0.72, tit, color="#ffffff", weight='bold',
                fontsize=8.5, ha='center', va='center')
        ax.text(x + w/2, y + h*0.35, desc, color="#ffffff",
                fontsize=7.2, ha='center', va='center', multialignment='center')
        
    # Flechas
    arrow_props = dict(arrowstyle="->,head_width=0.4,head_length=0.6", lw=2, color="#132740")
    
    # Fila superior (izq a der)
    ax.annotate('', xy=(0.28, 0.74), xytext=(0.25, 0.74), arrowprops=arrow_props)
    ax.annotate('', xy=(0.51, 0.74), xytext=(0.48, 0.74), arrowprops=arrow_props)
    ax.annotate('', xy=(0.74, 0.74), xytext=(0.71, 0.74), arrowprops=arrow_props)
    
    # Bajada de fila 1 a fila 2
    ax.annotate('', xy=(0.84, 0.44), xytext=(0.84, 0.58), arrowprops=arrow_props)
    
    # Fila inferior (der a izq)
    ax.annotate('', xy=(0.71, 0.28), xytext=(0.74, 0.28), arrowprops=arrow_props)
    ax.annotate('', xy=(0.48, 0.28), xytext=(0.51, 0.28), arrowprops=arrow_props)
    ax.annotate('', xy=(0.25, 0.28), xytext=(0.28, 0.28), arrowprops=arrow_props)
    
    plt.tight_layout()
    plt.savefig(output_png, bbox_inches='tight', dpi=220)
    plt.close()

# 2. NUMERACIÓN DE PÁGINAS PROFESIONAL
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8.5)
        self.setFillColor(colors.HexColor("#5f5e5e"))
        
        # Encabezado (páginas 2 en adelante)
        if self._pageNumber > 1:
            self.drawString(54, 11 * inch - 36, "Sistema de Gestión de Pósteres UCC — Guía de Flujo Operativo")
            self.setStrokeColor(colors.HexColor("#d5ddd3"))
            self.setLineWidth(0.5)
            self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)

        # Pie de página
        pie_texto = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(8.5 * inch - 54, 34, pie_texto)
        self.drawString(54, 34, "Universidad Cooperativa de Colombia • Plataforma Institucional")
        self.setStrokeColor(colors.HexColor("#d5ddd3"))
        self.setLineWidth(0.5)
        self.line(54, 46, 8.5 * inch - 54, 46)
        
        self.restoreState()

def compilar_pdf(ruta_pdf):
    doc = SimpleDocTemplate(
        ruta_pdf,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    # Estilos
    styles = getSampleStyleSheet()
    
    # Paleta institucional
    azul_ucc = colors.HexColor("#132740")
    cian_ucc = colors.HexColor("#00acc9")
    verde_ucc = colors.HexColor("#80ba27")
    gris_texto = colors.HexColor("#2c3e50")
    gris_suave = colors.HexColor("#f8fafc")
    borde_suave = colors.HexColor("#e2e8f0")

    titulo_style = ParagraphStyle(
        'TituloPrincipal',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=21,
        leading=25,
        textColor=azul_ucc,
        alignment=0,
        spaceAfter=4
    )
    
    subtitulo_style = ParagraphStyle(
        'SubtituloPrincipal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=cian_ucc,
        spaceAfter=14
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=azul_ucc,
        spaceBefore=12,
        spaceAfter=6
    )

    cuerpo_style = ParagraphStyle(
        'Cuerpo',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=gris_texto,
        spaceAfter=6
    )

    destacado_style = ParagraphStyle(
        'Destacado',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor("#0b6b7d"),
    )

    story = []

    # Encabezado Banner
    story.append(Paragraph("GUÍA DE OPERACIÓN Y FLUJO PASO A PASO", subtitulo_style))
    story.append(Paragraph("Ciclo Completo del Sistema de Gestión de Pósteres", titulo_style))
    story.append(Paragraph("Universidad Cooperativa de Colombia — Carreras de Ing. de Sistemas e Ing. Civil", cuerpo_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=cian_ucc, spaceBefore=4, spaceAfter=14))

    # Diagrama de flujo gráfico
    png_diagrama = "/tmp/diagrama_flujo_posters.png"
    generar_diagrama_flujo(png_diagrama)
    story.append(Image(png_diagrama, width=7.0*inch, height=3.8*inch))
    story.append(Spacer(1, 10))

    # Introducción
    intro_txt = (
        "El presente documento detalla la secuencia oficial de actividades que rige el desarrollo "
        "de un encuentro de pósteres de investigación, desde la configuración inicial de áreas físicas "
        "y registro de participantes, hasta la evaluación en rondas sucesivas y la premiación con diplomas."
    )
    story.append(Paragraph(intro_txt, cuerpo_style))
    story.append(Spacer(1, 8))

    # Tabla con los 10 pasos detallados
    pasos_detalle = [
        ("Fase 1: Configuración de Espacios y Ronda 1",
         "El Administrador / Super Admin crea las áreas de exhibición (ej. Auditorio, Plazoleta). "
         "<b>Numeración Continua:</b> Los cupos se numeran consecutivamente (ej. Espacio 1 al 8 en Piso 1, "
         "y continúa del 9 al 18 en Piso 2). Se define la Ronda 1 con sus criterios de evaluación, "
         "el cupo máximo que superará el corte (ej. 10 pósteres) y la cantidad de premios finales."),
        
        ("Fase 2: Registro de Usuarios y Admisión",
         "Docentes y estudiantes se registran especificando su carrera (Sistemas / Civil). "
         "Las cuentas pasan al panel de <b>Solicitudes</b> para aprobación del Administrador. "
         "El Admin asigna el rol de <b>Evaluador</b> a los docentes correspondientes."),
        
        ("Fase 3: Publicación de Pósteres",
         "El autor carga título, descripción, archivo PDF/imagen y asocia <b>profesores y materias</b> "
         "(se permite cruce de materias interdisciplinarias). El sistema calcula y asigna en tiempo real "
         "el siguiente <b>espacio físico continuo</b> disponible."),
         
        ("Fase 4: Asignación y Control de Conflictos",
         "En Ronda 1 se asigna automáticamente <b>un evaluador</b> de la misma área. "
         "<b>Control de Conflicto de Intereses:</b> Ni el autor ni ninguno de los profesores asignados al póster "
         "pueden calificarlo. Si no hay evaluadores disponibles sin conflicto, el sistema no asigna evaluador "
         "y notifica que se requiere asignación manual por parte del administrador."),

        ("Fase 5: Evaluación y Seguimiento de Ronda 1",
         "Cada evaluador ingresa a su mesa asignada y califica según los criterios específicos de la Ronda 1. "
         "El administrador supervisa las notas en vivo y puede reasignar evaluadores en caso de ausencia."),

        ("Fase 6: Cierre de Ronda 1 y Corte Automático",
         "Al finalizar el periodo de revisión, el Administrador cierra la Ronda 1. "
         "El sistema ordena los pósteres por promedio ponderado y confirma el <b>corte de selección</b>: "
         "únicamente los <i>N</i> mejores pósteres clasificados obtienen el pase a la siguiente fase."),

        ("Fase 7: Apertura de Ronda 2 (Gran Final)",
         "Se habilita la Ronda 2 (Gran Final en Auditorio). "
         "Solo compiten los pósteres seleccionados que superaron el corte. Los demás pósteres quedan archivados "
         "con sus calificaciones de participación registradas."),

        ("Fase 8: Reasignación de Evaluadores Ronda 2",
         "El sistema permite la reasignación aleatoria o manual de evaluadores para la final. "
         "En Ronda 2 pueden intervenir múltiples evaluadores por póster, promediando sus calificaciones "
         "y manteniendo intacto el filtro de no autoevaluación ni conflicto docente."),

        ("Fase 9: Calificación Final y Cierre de Ronda 2",
         "Los jurados califican la defensa oral en tarima/mesa. Al cerrar la Ronda 2, "
         "el sistema consolida los puntajes y adjudica automáticamente el <b>Podio de Ganadores</b> "
         "(1°, 2° y 3° puesto según los premios configurados)."),

        ("Fase 10: Certificación y Constancias",
         "Se activa la emisión y descarga de <b>certificados oficiales</b> con firma y datos del evento: "
         "diplomas de reconocimiento para los ganadores del podio y constancias de participación "
         "para autores y jurados evaluadores.")
    ]

    tabla_datos = []
    for titulo, desc in pasos_detalle:
        p_tit = Paragraph(f"<b>{titulo}</b>", ParagraphStyle('FaseTit', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=azul_ucc))
        p_desc = Paragraph(desc, ParagraphStyle('FaseDesc', parent=styles['Normal'], fontName='Helvetica', fontSize=8.5, leading=12, textColor=gris_texto))
        tabla_datos.append([p_tit, p_desc])

    t = Table(tabla_datos, colWidths=[2.2*inch, 4.8*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.white),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, borde_suave),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.HexColor("#f8fafc"), colors.white])
    ]))
    
    story.append(KeepTogether([
        Paragraph("Detalle de las 10 Etapas Operativas", h1_style),
        t
    ]))

    doc.build(story, canvasmaker=NumberedCanvas)
    if os.path.exists(png_diagrama):
        os.remove(png_diagrama)

if __name__ == "__main__":
    ruta = "/home/jhank/Desktop/app-posters/FLUJO-OPERATIVO-POSTERS.pdf"
    compilar_pdf(ruta)
    print("PDF generado con exito en:", ruta)
