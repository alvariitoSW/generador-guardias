import axios from "axios";

// En desarrollo, "/api" pasa por el proxy de Vite (ver vite.config.ts).
// En producción, define VITE_API_URL con la URL del backend desplegado
// (p.ej. https://tu-backend.up.railway.app/api).
// En Render, render.yaml pasa solo el host del backend (p.ej.
// "generador-guardias-backend-xxxx.onrender.com"), porque Render puede añadir
// un sufijo al nombre y la URL no se conoce de antemano. Lo normalizamos a
// una URL completa terminada en /api.
function resolveBaseURL(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return "/api";
  let url = /^https?:\/\//.test(value) ? value : `https://${value}`;
  url = url.replace(/\/+$/, "");
  if (!url.endsWith("/api")) url += "/api";
  return url;
}
const baseURL = resolveBaseURL(import.meta.env.VITE_API_URL);

// En el plan gratuito de Render, el backend "duerme" tras un rato inactivo y
// puede tardar hasta un minuto en despertar con la primera petición. Sin un
// timeout, una petición que nunca recibe respuesta se queda esperando para
// siempre y el usuario ve un botón bloqueado sin ningún mensaje de error.
export const api = axios.create({ baseURL, timeout: 70000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (!location.pathname.startsWith("/login")) {
        location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.data?.error) return err.response.data.error;
    if (err.code === "ECONNABORTED") {
      return "El servidor está tardando demasiado en responder. Si llevaba un rato sin uso puede estar 'despertando': espera unos segundos e inténtalo de nuevo.";
    }
    if (!err.response) {
      return "No se ha podido conectar con el servidor. Comprueba tu conexión o inténtalo de nuevo en un momento.";
    }
    return err.message;
  }
  return "Ha ocurrido un error inesperado";
}
