import { state } from './state.js';
import { toast, openModal, closeModal } from './utils.js';
import { api } from './api.js';
import { API_URL } from './config.js';
import { loadProducts } from './products.js';

let tempQty = 1;
let tempProduct = null;
let deliveryMode = 'delivery';

export function initCart() {
    loadCartFromStorage();
    renderCart();
    
    window.addToCart = addToCart;
    window.adjustModalQty = adjustModalQty;
    window.confirmAdd = confirmAdd;
    window.modQty = modQty;
    window.toggleCart = toggleCart;
    window.openCheckout = openCheckout;
    window.processPayment = processPayment;
    window.setDeliveryMode = setDeliveryMode;
    window.reorder = reorder;
}

function loadCartFromStorage() { 
    const c = JSON.parse(localStorage.getItem("dw_cart")); 
    if(c) state.cart = c; 
}

function saveCart() { 
    localStorage.setItem("dw_cart", JSON.stringify(state.cart)); 
}

function addToCart(id) {
    const p = state.products.find(x => x.id === id);
    if (!p || p.stock <= 0) return toast("Agotado", "error");

    tempProduct = p;
    tempQty = 1;

    document.getElementById("qty-prod-name").innerText = p.name;
    // Lógica de imagen segura
    let imgUrl = p.image;
    if (imgUrl && (imgUrl.includes('localhost') || imgUrl.includes('127.0.0.1'))) { try { imgUrl = new URL(imgUrl).pathname; } catch(e){} }
    const cleanBase = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    if (!imgUrl.startsWith('http')) { imgUrl = imgUrl.startsWith('/') ? `${cleanBase}${imgUrl}` : `${cleanBase}/static/images/${imgUrl}`; }
    
    document.getElementById("qty-prod-img").src = imgUrl;
    
    updateModalUI();
    openModal("qty-modal");
}

function adjustModalQty(delta) {
    if (!tempProduct) return;
    const newQty = tempQty + delta;
    if (newQty < 1) return;
    if (newQty > tempProduct.stock) return toast(`Solo quedan ${tempProduct.stock}`, "error");
    tempQty = newQty;
    updateModalUI();
}

function updateModalUI() {
    document.getElementById("qty-val").innerText = tempQty;
    document.getElementById("qty-subtotal").innerText = `$${(tempProduct.price * tempQty).toLocaleString('es-CL')}`;
}

function confirmAdd(checkout) {
    if (!tempProduct) return;
    const item = state.cart.find(x => x.id === tempProduct.id);
    
    if (item) {
        if (item.quantity + tempQty > tempProduct.stock) {
            return toast("Stock insuficiente", "error");
        }
        item.quantity += tempQty;
    } else {
        state.cart.push({ ...tempProduct, quantity: tempQty });
    }

    saveCart();
    renderCart();
    closeModal("qty-modal");
    if(checkout) openCheckout();
    else toast("Agregado al carrito", "success");
}

function renderCart() {
    const list = document.getElementById("cart-items");
    const cartCount = document.getElementById("cart-count");
    if(!list) return;
    
    list.innerHTML = "";
    
    state.cart.forEach(i => {
        list.innerHTML += `
            <div class="cart-item-row">
                <div>
                    <div style="font-weight:600;">${i.name}</div>
                    <div style="font-size:0.85rem; color:#666;">$${i.price.toLocaleString('es-CL')} x ${i.quantity}</div>
                </div>
                <div class="qty-control-mini">
                    <button onclick="modQty(${i.id}, -1)"><i class='bx bx-minus'></i></button>
                    <span>${i.quantity}</span>
                    <button onclick="modQty(${i.id}, 1)"><i class='bx bx-plus'></i></button>
                </div>
            </div>
        `;
    });
    
    const count = state.cart.reduce((a,b)=>a+b.quantity,0);
    const total = state.cart.reduce((a,b)=>a+b.price*b.quantity,0);
    document.getElementById("cart-total").innerText = `$${total.toLocaleString('es-CL')}`;
    
    if(cartCount) {
        cartCount.innerText = count;
        cartCount.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

function modQty(id, d) {
    const item = state.cart.find(x => x.id === id);
    const p = state.products.find(x => x.id === id);
    if(!item) return;
    const max = p ? p.stock : 999;

    item.quantity += d;
    if(item.quantity > max) item.quantity = max;
    if(item.quantity <= 0) state.cart = state.cart.filter(x => x.id !== id);
    
    saveCart(); 
    renderCart();
}

function toggleCart() {
    const cart = document.getElementById("cart-sidebar");
    const overlay = document.getElementById("cart-overlay");
    
    if(cart.classList.contains("open")) {
        cart.classList.remove("open");
        if(overlay) overlay.classList.remove("active");
        document.body.style.overflow = '';
    } else {
        cart.classList.add("open");
        if(overlay) overlay.classList.add("active");
        document.body.style.overflow = 'hidden';
    }
}

function openCheckout() {
    if (state.cart.length === 0) return toast("Carrito vacío", "error");
    if (!state.user) {
        toast("Inicia sesión primero", "info");
        return openModal("login-modal");
    }

    document.getElementById("chk-total").innerText = document.getElementById("cart-total").innerText;
    document.getElementById("chk-email").innerText = state.user.email;
    
    toggleCart(); 
    openModal("checkout-modal");
}

function setDeliveryMode(mode) {
    deliveryMode = mode;
    document.querySelectorAll('.delivery-option').forEach(el => el.classList.remove('active'));
    document.getElementById(`opt-${mode}`).classList.add('active');
    
    if (mode === 'delivery') {
        document.getElementById('delivery-info').classList.remove('hidden');
        document.getElementById('pickup-info').classList.add('hidden');
    } else {
        document.getElementById('delivery-info').classList.add('hidden');
        document.getElementById('pickup-info').classList.remove('hidden');
    }
}

async function processPayment() {
    try {
        const btn = document.querySelector("#checkout-modal .btn-primary");
        btn.innerText = "Procesando...";
        btn.disabled = true;

        const order = {
            customer_email: state.user.email,
            items: state.cart.map(i => ({ product_id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
            total: state.cart.reduce((a,b)=>a+b.price*b.quantity,0)
        };

        await api("/orders", "POST", order);
        state.cart = []; 
        saveCart(); 
        renderCart(); 
        await loadProducts();

        closeModal("checkout-modal");
        
        const msg = deliveryMode === 'delivery' 
            ? "¡Pedido en camino! Tu repartidor saldrá pronto." 
            : "¡Pedido recibido! Te avisaremos para el retiro.";
        toast(msg, "success");

    } catch(e) { 
        toast(e.message, "error"); 
    } finally {
        const btn = document.querySelector("#checkout-modal .btn-primary");
        if(btn) { btn.innerText = "Confirmar y Pagar"; btn.disabled = false; }
    }
}

function reorder(orderIndex) {
    if (!state.orderHistory || !state.orderHistory[orderIndex]) return;
    const pastOrder = state.orderHistory[orderIndex];
    
    pastOrder.items.forEach(item => {
        const product = state.products.find(p => p.id === item.product_id);
        if (product) {
            const existing = state.cart.find(x => x.id === product.id);
            if (existing) existing.quantity += item.quantity;
            else state.cart.push({ ...product, quantity: item.quantity });
        }
    });
    
    saveCart();
    renderCart();
    closeModal('history-modal');
    toggleCart(); 
    toast("¡Productos agregados!", "success");
}