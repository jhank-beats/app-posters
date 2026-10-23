// src/categorias.js — etiquetas legibles de categorías (para mostrar, no para enviar al backend).

const ETIQUETAS = {
  desarrolloWeb: 'Desarrollo Web',
  programacion: 'Programación',
  backend: 'Backend',
  frontend: 'Frontend',
  calculo: 'Cálculo',
  estadistica: 'Estadística',
};

/** Devuelve la forma legible con tildes. Si no se conoce, regresa el valor tal cual. */
export function categoriaLegible(valor) {
  if (!valor) return '';
  const v = String(valor);
  return ETIQUETAS[v] || ETIQUETAS[v.toLowerCase()] || v;
}
