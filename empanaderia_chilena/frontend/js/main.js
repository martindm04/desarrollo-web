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
window.handleProfileClick = function() {
    if (state.user) {
        window.openOrderHistory();
    } else {
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