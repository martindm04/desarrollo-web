import { initAuth } from './auth.js';
import { initCart } from './cart.js';
import { initProducts } from './products.js';
import { initAdmin } from './admin.js';
import { closeModals, openModal, closeModal, toast } from './utils.js';
import { state } from './state.js'; // Importamos el estado

// --- EXPOSICIÓN GLOBAL DE FUNCIONES ---
window.openModal = openModal;
window.closeModal = closeModal;
window.closeModals = closeModals;
window.toast = toast;

// Función para el botón de perfil del móvil
window.handleProfileClick = function() {
    console.log("Estado usuario:", state.user); // Para depurar
    if (state.user) {
        // Si ya está logueado, intentamos abrir el historial
        if (window.openOrderHistory) {
            window.openOrderHistory();
        } else {
            toast("Cargando historial...", "info");
        }
    } else {
        // Si no, abrimos el login
        window.openModal('login-modal');
    }
};

document.addEventListener("DOMContentLoaded", () => {
    initAuth();
    initCart();
    initProducts();
    initAdmin();

    document.addEventListener("keydown", e => { 
        if(e.key === "Escape") closeModals(); 
    });
});