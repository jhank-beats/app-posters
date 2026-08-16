import { useState } from "react";

const faqs = [
  {
    question: "¿Puedo usar FlowBite en proyectos open-source?",
    answer:
      "Generalmente, sí está permitido usar FlowBite en proyectos open-source, siempre y cuando no sea una librería de UI, un tema, una plantilla o un page-builder que se considere una alternativa a FlowBite en sí. Con eso dicho, siéntete libre de usar este kit de diseño en tus proyectos open-source. Encuentra más información leyendo la licencia.",
  },
  {
    question: "¿Dónde puedo acceder a mis archivos descargados?",
    answer:
      "Una vez que completes la compra, recibirás un enlace de descarga inmediato y también se enviará a tu correo electrónico.",
  },
  {
    question: "¿Puedo usar FlowBite para fines comerciales?",
    answer:
      "¡Sí! FlowBite está licenciado bajo MIT, por lo que puedes usarlo libremente en proyectos comerciales y personales.",
  },
  {
    question: "¿Qué soporte de navegadores tiene?",
    answer:
      "FlowBite está diseñado con Tailwind CSS y es compatible con todos los navegadores modernos: Chrome, Firefox, Safari, Edge (versión 12+), etc.",
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

        <h2 className="faq-titulo">Preguntas Frecuentes</h2>

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
                  {faq.question.includes("licencia") && (
                    <a href="#" className="faq-link">
                      {" la licencia"}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
