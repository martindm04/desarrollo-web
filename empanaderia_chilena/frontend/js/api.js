import { API_URL } from './config.js';
import { state } from './state.js';

export async function api(endpoint, method="GET", body=null) {
    const headers = { "Content-Type": "application/json" };
    if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
    
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method, headers, body: body ? JSON.stringify(body) : null
        });

        const data = await res.json();

        if (!res.ok) {
            if (res.status === 429) throw new Error("⛔ Demasiados intentos. Espera 1 min.");
            throw new Error(data.detail || "Error en la petición");
        }
        return data;
    } catch (e) {
        throw e;
    }
}
