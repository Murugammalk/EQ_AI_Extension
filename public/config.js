// ── EQ of AI — change BASE_URL only ──────────────────────────
// Dev:  http://127.0.0.1:5000
// Prod: https://api.innometrixtechub.in

const BASE_URL = "http://127.0.0.1:5002";
// const BASE_URL = "https://api.innometrixtechub.in";

const ENDPOINTS = {
  validate: `${BASE_URL}/session/validate`,
  login: `${BASE_URL}/Login/Extension`,
  logout: `${BASE_URL}/Extension/Logout`,
  refresh: `${BASE_URL}/Extension/refresh-token`,
  aiValidate: `${BASE_URL}/ai_validation_data`,
  aiAction: `${BASE_URL}/ai_update_action`,
  feedback: `${BASE_URL}/submit-feedback`,
};

self.ENDPOINTS = ENDPOINTS;
