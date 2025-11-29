export const API_PORT = 8000;
export const API_HOST = window.location.hostname; 
export const API_URL = `http://${API_HOST}:${API_PORT}`;

console.log(`📡 Configurado para conectar a: ${API_URL}`);