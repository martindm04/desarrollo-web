import { initAuth } from './auth.js';
import { initCart } from './cart.js';
import { initProducts } from './products.js';
import { initAdmin } from './admin.js';
import { closeModals } from './utils.js';

document.addEventListener("DOMContentLoaded", () => {
    initAuth();
    initCart();
    initProducts();
    initAdmin();
    
    document.addEventListener("keydown", e => { if(e.key === "Escape") closeModals(); });
});