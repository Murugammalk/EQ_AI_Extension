import axios from "axios";

const BASE_API = import.meta.env.VITE_BASE_API || "http://127.0.0.1:5000";
const AUTH_CHANGED_EVENT = "eq-auth-changed";
const SKIP_REFRESH_PATHS = [
  "/Login/Extension",
  "/session/validate",
  "/Extension/refresh-token",
  "/Extension/Logout",
];

axios.defaults.withCredentials = true;

let isRefreshing = false;
let queue: Array<{
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
}> = [];

const shouldSkipRefresh = (url?: string) =>
  !url || SKIP_REFRESH_PATHS.some((path) => url.includes(path));

axios.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      shouldSkipRefresh(original.url)
    ) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => queue.push({ resolve, reject }))
        .then(() => axios(original))
        .catch((e) => Promise.reject(e));
    }

    isRefreshing = true;

    try {
      await axios.post(`${BASE_API}/Extension/refresh-token`);
      queue.forEach(({ resolve }) => resolve(null));
      return axios(original);
    } catch (err) {
      queue.forEach(({ reject }) => reject(err));
      localStorage.removeItem("user");
      localStorage.removeItem("eq_login_ts");
      chrome.storage?.local?.remove(["user_email", "user_name"]);
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
      queue = [];
    }
  },
);

export default axios;
