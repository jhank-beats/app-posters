import { useState } from "react";

const faqs = [
  {
    question: "¿Qué es la Comunidad GensTI?",
    answer:
      "Es la comunidad de la Facultad de Ingeniería de Sistemas de la Universidad Cooperativa de Colombia (UCC). Esta plataforma permite gestionar, organizar y evaluar los pósters de los proyectos de investigación de la comunidad.",
  },
  {
    question: "¿Quién puede registrarse?",
    answer:
      "Cualquier persona puede enviar una solicitud de registro completando el formulario con nombres, apellidos, correo, contraseña y carrera. La solicitud queda pendiente y es gestionada por los administradores, quienes pueden activarla o rechazarla desde el panel de solicitudes.",
  },
  {
    question: "¿Cómo puedo registrar un poster?",
    answer:
      "Debes iniciar sesión en la plataforma. Desde tu panel puedes usar el formulario de subida, donde se solicitan título, autores, descripción, categoría, palabras clave y el archivo del póster (.pdf, .jpg o .png). El sistema valida que hayas iniciado sesión y que todos los campos estén completos antes de publicarlo.",
  },
  {
    question: "¿Quién puede evaluar los posters?",
    answer:
      "Solo los usuarios con el rol de evaluador. El evaluador consulta la lista de pósters que le fueron asignados y registra la calificación de cada criterio, además de sus observaciones.",
  },
  {
    question: "¿Cómo se asignan los evaluadores?",
    answer:
      "Los administradores asignan evaluadores a cada póster desde la gestión de pósters. Un evaluador solo puede acceder y evaluar los pósters que le hayan sido asignados.",
  },
  {
    question: "¿Dónde puedo consultar mis proyectos?",
    answer:
      "En la sección \"Mis Pósters Publicados\" del panel de usuario, donde se listan los pósters que registraste. Si un póster ya fue evaluado, puedes consultar su promedio de calificación y el detalle por criterio.",
  },
  {
    question: "¿Qué ocurre después de enviar un poster?",
    answer:
      "El póster queda registrado en la plataforma. La administración puede asignarle evaluadores y un espacio físico de presentación; luego los evaluadores registran sus valoraciones, de las que se calcula un promedio.",
  },
  {
    question: "¿Quién puede acceder a los posters?",
    answer:
      "El acceso depende del rol del usuario. Los usuarios autorizados consultan pósters publicados y sus calificaciones; los evaluadores solo los pósters asignados; y los administradores gestionan el inventario completo. La página principal es pública e informativa y no muestra pósters reales.",
  },
];

export default function PreguntasFrecuentes({ cerrar }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const toggle = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <div className="faq-overlay" onClick={cerrar}>
      <section className="faq-container" onClick={(e) => e.stopPropagation()}>
        <button className="faq-cerrar" onClick={cerrar}>
          ×
        </button>

        <h2 className="faq-titulo">
          <span className="seccion-eyebrow faq-eyebrow">Centro de Ayuda</span>
          Preguntas Frecuentes
        </h2>

        <div className="faq-lista">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="faq-item"
              data-state={activeIndex === index ? "open" : "closed"}
            >
              <button
                className="faq-pregunta"
                onClick={() => toggle(index)}
                aria-expanded={activeIndex === index}
              >
                <span>{faq.question}</span>
                <svg
                  className="faq-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              <div className="faq-respuesta-wrapper">
                <div className="faq-respuesta">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}