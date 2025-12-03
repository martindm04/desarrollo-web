import { initAuth } from './auth.js';
import { initCart } from './cart.js';
import { initProducts } from './products.js';
import { initAdmin } from './admin.js';
import { closeModals, openModal, closeModal, toast } from './utils.js';
import { state } from './state.js';

window.openModal = openModal;
window.closeModal = closeModal;
window.closeModals = closeModals;
window.toast = toast;

// Lógica mejorada para Perfil Móvil
window.handleProfileClick = function() {
    if (state.user) {
        // Si está logueado, abrimos el menú de opciones de usuario
        openUserMenu();
    } else {
        // Si no, login directo
        window.openModal('login-modal');
    }
};

function openUserMenu() {
    // Verificar si ya existe el menú, si no, crearlo
    let menu = document.getElementById('mobile-user-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'mobile-user-menu';
        menu.className = 'modal'; // Reusamos estilos de modal
        menu.innerHTML = `
            <div class="modal-box" style="padding: 20px; text-align: center;">
                <h3 style="margin-bottom: 20px;">Hola, <span id="mobile-username"></span></h3>
                <div style="display: grid; gap: 10px;">
                    <button class="btn-secondary" onclick="window.openOrderHistory(); closeModal('mobile-user-menu')">📜 Mis Pedidos</button>
                    <button id="mobile-admin-btn-menu" class="btn-secondary hidden" onclick="window.toggleAdminPanel(); closeModal('mobile-user-menu')">⚙️ Panel Admin</button>
                    <button class="btn-primary" style="background: #E53E3E;" onclick="window.logout()">👋 Cerrar Sesión</button>
                </div>
                <button onclick="closeModal('mobile-user-menu')" style="margin-top: 15px; border: none; background: none; color: #718096;">Cancelar</button>
            </div>
        `;
        document.body.appendChild(menu);
    }
    
    // Actualizar datos dinámicos
    document.getElementById('mobile-username').innerText = state.user.name.split(' ')[0];
    const adminBtn = document.getElementById('mobile-admin-btn-menu');
    if (state.user.role === 'admin') adminBtn.classList.remove('hidden');
    else adminBtn.classList.add('hidden');

    window.openModal('mobile-user-menu');
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("Iniciando app...");
    try {
        initAuth();
        initCart();
        initProducts();
        initAdmin();
        console.log("App lista.");
    } catch (e) {
        console.error(e);
    }

    document.addEventListener("keydown", e => { 
        if(e.key === "Escape") closeModals(); 
    });
});