const API = "http://127.0.0.1:8000";
let state = { user: null, token: null, products: [], cart: [] };

// --- INICIO ---
document.addEventListener("DOMContentLoaded", async () => {
    loadSession();
    await loadProducts();
    renderCart();
    
    // Eventos Globales
    document.addEventListener("keydown", e => { if(e.key === "Escape") closeModals(); });
    
    // Búsqueda y Filtros
    const searchInput = document.getElementById("search");
    const catFilter = document.getElementById("cat-filter");
    
    if(searchInput) searchInput.addEventListener("keyup", renderGrid);
    if(catFilter) catFilter.addEventListener("change", renderGrid);
});

// --- API ---
async function api(endpoint, method="GET", body=null) {
    const headers = { "Content-Type": "application/json" };
    if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
    
    try {
        const res = await fetch(`${API}${endpoint}`, {
            method, headers, body: body ? JSON.stringify(body) : null
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error en la petición");
        return data;
    } catch (e) {
        throw e;
    }
}

async function loadProducts() {
    try {
        state.products = await api("/products");
        renderGrid();
        renderCarousel();
    } catch (e) { 
        console.error(e);
        toast("Error cargando productos. Revisa el backend.", "error"); 
    }
}

// --- UI: GRILLA DE PRODUCTOS ---
function renderGrid() {
    const grid = document.getElementById("grid");
    if(!grid) return;

    const term = document.getElementById("search").value.toLowerCase();
    const cat = document.getElementById("cat-filter").value;
    
    grid.innerHTML = "";
    
    const filtered = state.products.filter(p => 
        p.name.toLowerCase().includes(term) && (cat === "all" || p.category === cat)
    );

    if(filtered.length === 0) {
        document.getElementById("empty-state").classList.remove("hidden");
    } else {
        document.getElementById("empty-state").classList.add("hidden");
    }

    filtered.forEach(p => {
        const card = document.createElement("div");
        card.className = `card ${p.stock === 0 ? 'out' : ''}`;
        card.innerHTML = `
            <span class="badge ${p.category}">${p.category}</span>
            <div class="card-img"><img src="${p.image}" onerror="this.src='https://via.placeholder.com/150?text=Sin+Foto'"></div>
            <div class="card-info">
                <h3>${p.name}</h3>
                <div style="display:flex; justify-content:space-between;">
                    <b>$${p.price.toLocaleString('es-CL')}</b>
                    <small>${p.stock > 0 ? 'Stock: '+p.stock : 'Agotado'}</small>
                </div>
                <button class="btn-primary" style="width:100%; margin-top:10px;" onclick="addToCart(${p.id})">
                    ${p.stock > 0 ? 'Agregar' : 'Sin Stock'}
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- UI: CARRUSEL (SLIDER) ---
let currentSlide = 0;
let carouselInterval;

function renderCarousel() {
    const track = document.getElementById("carousel-track");
    const container = document.getElementById("hero-carousel");
    
    // Filtrar destacados
    const featured = state.products.filter(p => p.image.startsWith('http') && p.stock > 0).slice(0, 5);
    
    if(featured.length === 0) {
        if(container) container.style.display = 'none';
        return;
    }
    if(container) container.style.display = 'block';

    track.innerHTML = "";
    
    featured.forEach((p, index) => {
        const slide = document.createElement("div");
        slide.className = "carousel-slide";
        slide.style.background = index % 2 === 0 ? "linear-gradient(to right, #FFF5F5, #fff)" : "linear-gradient(to right, #F0F9FF, #fff)";
        
        slide.innerHTML = `
            <div class="carousel-content">
                <h2>${p.name}</h2>
                <p>Sabor artesanal chileno.</p>
                <button class="btn-primary" onclick="addToCart(${p.id})">
                    Comprar ahora $${p.price.toLocaleString('es-CL')}
                </button>
            </div>
            <img src="${p.image}" class="carousel-img">
        `;
        track.appendChild(slide);
    });

    currentSlide = 0;
    updateCarousel();
    startAutoSlide();
}

function moveSlide(direction) {
    const track = document.getElementById("carousel-track");
    if(!track) return;
    const totalSlides = track.children.length;
    currentSlide += direction;
    if (currentSlide < 0) currentSlide = totalSlides - 1;
    if (currentSlide >= totalSlides) currentSlide = 0;
    updateCarousel();
    resetAutoSlide();
}

function updateCarousel() {
    const track = document.getElementById("carousel-track");
    if(track) track.style.transform = `translateX(-${currentSlide * 100}%)`;
}

function startAutoSlide() {
    clearInterval(carouselInterval);
    carouselInterval = setInterval(() => moveSlide(1), 5000);
}

function resetAutoSlide() {
    clearInterval(carouselInterval);
    startAutoSlide();
}

// --- CART (CARRITO) ---
function addToCart(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    
    // Validar si hay stock localmente
    if (p.stock <= 0) return toast("Producto agotado", "error");

    const item = state.cart.find(x => x.id === id);
    if (item) {
        if (item.quantity < p.stock) item.quantity++;
        else return toast("No hay más stock disponible", "error");
    } else {
        state.cart.push({ ...p, quantity: 1 });
    }
    saveCart(); renderCart(); toast("Agregado al carrito", "success");
}

function renderCart() {
    const list = document.getElementById("cart-items");
    if(!list) return;
    
    list.innerHTML = "";
    let total = 0;
    
    state.cart.forEach(i => {
        total += i.price * i.quantity;
        list.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                <div><b>${i.name}</b><br>$${i.price} x ${i.quantity}</div>
                <div style="display:flex; align-items:center; gap:5px;">
                    <button class="qty-sm" onclick="modQty(${i.id}, -1)">-</button>
                    <span>${i.quantity}</span>
                    <button class="qty-sm" onclick="modQty(${i.id}, 1)">+</button>
                </div>
            </div>
        `;
    });
    
    const count = state.cart.reduce((a,b)=>a+b.quantity,0);
    document.getElementById("cart-total").innerText = `$${total.toLocaleString('es-CL')}`;
    document.getElementById("cart-count").innerText = count;
    
    // Actualizar también el subtotal/iva si existen en el HTML
    const net = Math.round(total / 1.19);
    const tax = total - net;
    if(document.getElementById("cart-net")) document.getElementById("cart-net").innerText = `$${net.toLocaleString('es-CL')}`;
    if(document.getElementById("cart-tax")) document.getElementById("cart-tax").innerText = `$${tax.toLocaleString('es-CL')}`;
}

function modQty(id, d) {
    const item = state.cart.find(x => x.id === id);
    const p = state.products.find(x => x.id === id);
    if(!item || !p) return;

    item.quantity += d;
    if (item.quantity > p.stock) item.quantity = p.stock;
    if (item.quantity <= 0) state.cart = state.cart.filter(x => x.id !== id);
    saveCart(); renderCart();
}

// --- CHECKOUT (PAGO) ---
function openCheckout() {
    if (state.cart.length === 0) return toast("Tu carrito está vacío", "error");
    if (!state.user) {
        toast("Inicia sesión para continuar", "info");
        return openModal("login-modal");
    }

    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById("chk-total").innerText = `$${total.toLocaleString('es-CL')}`;
    document.getElementById("chk-email").innerText = state.user.email;

    toggleCart(); // Cerrar sidebar
    openModal("checkout-modal"); // Abrir confirmación
}

async function processPayment() {
    try {
        const order = {
            customer_email: state.user.email,
            items: state.cart.map(i => ({ product_id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
            total: state.cart.reduce((a,b)=>a+b.price*b.quantity,0)
        };
        await api("/orders", "POST", order);
        state.cart = []; saveCart(); renderCart(); loadProducts();
        closeModal("checkout-modal");
        toast("¡Pedido confirmado exitosamente!", "success");
    } catch(e) { toast(e.message, "error"); }
}

// --- AUTH (LOGIN & REGISTER) ---
async function login() {
    const u = document.getElementById("login-user").value;
    const p = document.getElementById("login-pass").value;
    
    if(!u || !p) return toast("Ingresa datos válidos", "error");

    try {
        const data = await api("/login", "POST", { identifier: u, password: p });
        state.user = data.user; state.token = data.access_token;
        saveSession(); updateAuthUI(); closeModal("login-modal");
        toast(`Bienvenido ${state.user.name}`, "success");
    } catch { toast("Credenciales incorrectas", "error"); }
}

async function register() {
    const name = document.getElementById("reg-name").value;
    const email = document.getElementById("reg-email").value;
    const pass = document.getElementById("reg-pass").value;

    if (!name || !email || !pass) return toast("Completa todos los campos", "error");
    if (pass.length < 8) return toast("Mínimo 8 caracteres", "error");

    try {
        await api("/register", "POST", { name, email, password: pass });
        toast("Cuenta creada. Inicia sesión.", "success");
        closeModal("register-modal");
        openModal("login-modal");
    } catch (e) { toast(e.message || "Error al registrar", "error"); }
}

function logout() {
    state.user = null; state.token = null;
    localStorage.removeItem("dw_sess"); 
    updateAuthUI();
    toast("Sesión cerrada");
    window.location.reload();
}

function updateAuthUI() {
    const userNav = document.getElementById("user-nav"); // Asegúrate de que este ID exista en HTML o usa la lógica de abajo
    const authLinks = document.getElementById("auth-links");
    const userInfo = document.getElementById("user-info");

    if (state.user) {
        if(authLinks) authLinks.classList.add("hidden");
        if(userInfo) {
            userInfo.classList.remove("hidden");
            userInfo.style.display = "flex"; // Forzar display flex
            document.getElementById("user-name-display").innerText = state.user.name;
        }
        if(state.user.role === "admin") {
            const adminLink = document.getElementById("admin-link");
            if(adminLink) adminLink.classList.remove("hidden");
        }
    } else {
        if(authLinks) {
            authLinks.classList.remove("hidden");
            authLinks.style.display = "flex"; // Resetear display
        }
        if(userInfo) userInfo.classList.add("hidden");
    }
}

// --- UTILS & MODALS ---
function toast(msg, type="info") {
    const box = document.getElementById("toast-box");
    if(!box) return;
    const t = document.createElement("div");
    t.style.background = type==="error" ? "#e53e3e" : "#38a169";
    t.style.color = "white"; t.style.padding = "12px 20px"; t.style.borderRadius = "8px";
    t.style.marginBottom = "10px"; t.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
    t.innerText = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// CORRECCIÓN CLAVE PARA QUE FUNCIONEN LOS BOTONES
function openModal(id) { 
    const el = document.getElementById(id);
    if(el) {
        el.classList.remove("hidden"); // Quitar la clase que tiene !important
        el.style.display = "flex";     // Aplicar flex
    }
}

function closeModal(id) { 
    const el = document.getElementById(id);
    if(el) {
        el.classList.add("hidden");    // Volver a poner la clase
        el.style.display = "none";
    }
}

function closeModals() { 
    document.querySelectorAll('.modal').forEach(m => {
        m.classList.add("hidden");
        m.style.display = "none";
    }); 
}

function toggleCart() { 
    const sb = document.getElementById("cart-sidebar");
    const overlay = document.getElementById("cart-overlay");
    if(sb.style.right === "0px") {
        sb.style.right = "-400px";
        if(overlay) overlay.style.display = "none";
    } else {
        sb.style.right = "0px";
        if(overlay) overlay.style.display = "block";
    }
}

function nextFocus(event, nextId) {
    if (event.key === "Enter") {
        const el = document.getElementById(nextId);
        if(el) el.focus();
        if(nextId.includes('btn')) el.click();
    }
}

// Persistencia
function saveSession() { localStorage.setItem("dw_sess", JSON.stringify({u:state.user, t:state.token})); }
function loadSession() { 
    const s = JSON.parse(localStorage.getItem("dw_sess")); 
    if(s) { state.user=s.u; state.token=s.t; updateAuthUI(); } 
}
function saveCart() { localStorage.setItem("dw_cart", JSON.stringify(state.cart)); }
function loadCartFromStorage() { 
    const c = JSON.parse(localStorage.getItem("dw_cart")); 
    if(c) { state.cart=c; renderCart(); } 
}
loadCartFromStorage();
