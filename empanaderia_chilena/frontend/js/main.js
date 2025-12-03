import { initAuth } from './auth.js';
import { initCart } from './cart.js';
import { initProducts } from './products.js';
import { initAdmin } from './admin.js';
import { closeModals, openModal, closeModal, toast } from './utils.js';

window.openModal = openModal;
window.closeModal = closeModal;
window.closeModals = closeModals;
window.toast = toast;

document.addEventListener("DOMContentLoaded", () => {
    initAuth();
    initCart();
    initProducts();
    initAdmin();

    document.addEventListener("keydown", e => { 
        if(e.key === "Escape") closeModals(); 
    });
});