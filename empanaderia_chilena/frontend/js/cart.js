import { state } from './state.js';
import { toast, openModal, closeModal } from './utils.js';
import { api } from './api.js';
import { API_URL } from './config.js';
import { loadProducts } from './products.js';

let tempQty = 1;
let tempProduct = null;

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
    let imgUrl = p.image.startsWith('http') ? p.image : `${API_URL}${p.image.startsWith('/')?'':'/'}${p.image}`;
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
                    <button onclick="modQty(${i.id}, -1)">-</button>
                    <span>${i.quantity}</span>
                    <button onclick="modQty(${i.id}, 1)">+</button>
                </div>
            </div>
        `;
    });
    
    const count = state.cart.reduce((a,b)=>a+b.quantity,0);
    const total = state.cart.reduce((a,b)=>a+b.price*b.quantity,0);
    document.getElementById("cart-total").innerText = `$${total.toLocaleString('es-CL')}`;
    
    const net = Math.round(total / 1.19);
    const tax = total - net;
    
    const elNet = document.getElementById("cart-net");
    const elTax = document.getElementById("cart-tax");
    if(elNet) elNet.innerText = `$${net.toLocaleString('es-CL')}`;
    if(elTax) elTax.innerText = `$${tax.toLocaleString('es-CL')}`;

    if(cartCount) {
        cartCount.innerText = count;
        cartCount.style.display = count > 0 ? 'flex' : 'none';
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
        if(overlay) overlay.style.display = "none";
        document.body.style.overflow = '';
    } else {
        cart.classList.add("open");
        if(overlay) overlay.style.display = "block";
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
        toast("¡Pedido Exitoso!", "success");
    } catch(e) { 
        toast(e.message, "error"); 
    } finally {
        const btn = document.querySelector("#checkout-modal .btn-primary");
        if(btn) { btn.innerText = "Pagar Ahora"; btn.disabled = false; }
    }
}