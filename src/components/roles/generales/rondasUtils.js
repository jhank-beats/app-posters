// Utilidades compartidas de rondas (frontend).

// El nombre de la ronda ya puede incluir "Ronda N ·", así que se evita duplicar.
export const tituloRonda = (ronda) => {
    if (!ronda) return '';
    const nombre = ronda.nombre || '';
    return /^ronda\s/i.test(nombre) ? nombre : `Ronda ${ronda.numero} · ${nombre}`;
};

// Texto del premio ("🥇 1er lugar", "3er lugar"…).
export const textoLugar = (lugar, premio) => {
    if (premio) return premio;
    if (!lugar) return '—';
    return `${lugar}º lugar`;
};
