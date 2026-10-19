const SERVER_URL = `http://${window.location.hostname}:8000`;
const TTL_MS = 5000;

let cache = null; // { data, timestamp }
let inflight = null;

export const obtenerRondasResumen = ({ refetch = false } = {}) => {
    if (inflight) return inflight;
    if (!refetch && cache && Date.now() - cache.timestamp < TTL_MS) {
        return Promise.resolve(cache.data);
    }
    inflight = fetch(`${SERVER_URL}/api/Rondas.php?action=resumen`)
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
