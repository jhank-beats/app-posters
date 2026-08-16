import ReactGA from "react-ga4";

// Reemplaza con tu ID de medición de GA4
const GA_MEASUREMENT_ID = "G-MBDX9GB54W";

export const initGA = () => {
  ReactGA.initialize(GA_MEASUREMENT_ID);
};

export const logPageView = (path) => {
  ReactGA.send({ hitType: "pageview", page: path });
};
