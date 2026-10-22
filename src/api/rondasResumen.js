import { API_BASE } from '../config.js';
const TTL_MS = 5000;

let cache = null; // { data, timestamp }
let inflight = null;

export const obtenerRondasResumen = ({ refetch = false } = {}) => {
    if (inflight) return inflight;
    if (!refetch && cache && Date.now() - cache.timestamp < TTL_MS) {
        return Promise.resolve(cache.data);
    }
    inflight = fetch(`${API_BASE}/Rondas.php?action=resumen`)
        .then((res) => res.json())
        .then((data) => {
            cache = { data, timestamp: Date.now() };
            return data;
        })
        .finally(() => {
            inflight = null;
        });
    return inflight;
};

export const invalidarRondasResumen = () => {
    cache = null;
};
