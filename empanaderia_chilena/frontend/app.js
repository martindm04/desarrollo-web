const API = "http://127.0.0.1:8000";
let state = { user: null, token: null, products: [], cart: [] };

// --- INICIO ---
document.addEventListener("DOMContentLoaded", async () => {
    loadSession();
    await loadProducts();
    renderCart();
    
    // Eventos Globales
    document.addEventListener("keydown", e => { if(e.key === "Escape") closeModals(); });
    document.getElementById("search").addEventListener("keyup", renderGrid);
    document.getElementById("cat-filter").addEventListener("change", renderGrid);
});

// --- API ---
async function api(endpoint, method="GET", body=null) {
    const headers = { "Content-Type": "application/json" };
    if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
    
    const res = await fetch(`${API}${endpoint}`, {
        method, headers, body: body ? JSON.stringify(body) : null
    });
    if (!res.ok) throw new Error((await res.json()).detail || "Error");
    return res.json();
}

async function loadProducts() {
    try {
        state.products = await api("/products");
        renderGrid();
        renderCarousel();
    } catch (e) { toast("Error cargando productos", "error"); }
}

// --- UI ---
function renderGrid() {
    const grid = document.getElementById("grid");
    const term = document.getElementById("search").value.toLowerCase();
    const cat = document.getElementById("cat-filter").value;
    
    grid.innerHTML = "";
    const filtered = state.products.filter(p => 
        p.name.toLowerCase().includes(term) && (cat === "all" || p.category === cat)
    );

    filtered.forEach(p => {
        const card = document.createElement("div");
        card.className = `card ${p.stock === 0 ? 'out' : ''}`;
        card.innerHTML = `
            <span class="badge ${p.category}">${p.category}</span>
            <div class="card-img"><img src="${p.image}" onerror="this.src='https://via.placeholder.com/150?text=Sin+Foto'"></div>
            <div class="card-info">
                <h3>${p.name}</h3>
                <div style="display:flex; justify-content:space-between;">
                    <b>$${p.price}</b>
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

// --- CARRUSEL LOGIC ---
let currentSlide = 0;
let carouselInterval;

function renderCarousel() {
    const track = document.getElementById("carousel-track");
    const container = document.getElementById("hero-carousel");
    
    // 1. Filtrar productos destacados (con imagen y stock)
    const featured = state.products.filter(p => p.image.startsWith('http') && p.stock > 0).slice(0, 5);
    
    if(featured.length === 0) {
        if(container) container.style.display = 'none';
        return;
    } else {
        if(container) container.style.display = 'block';
    }

    track.innerHTML = "";
    
    featured.forEach((p, index) => {
        const slide = document.createElement("div");
        slide.className = "carousel-slide";
        // Colores alternados para el fondo
        slide.style.background = index % 2 === 0 ? "linear-gradient(to right, #FFF5F5, #fff)" : "linear-gradient(to right, #F0F9FF, #fff)";
        
        slide.innerHTML = `
            <div class="carousel-content">
                <h2>${p.name}</h2>
                <p>El sabor tradicional chileno, recién horneado para ti.</p>
                <button class="btn-primary" onclick="addToCart(${p.id})">
                    Ordenar Ahora - $${p.price}
                </button>
            </div>
            <img src="${p.image}" class="carousel-img" alt="${p.name}">
        `;
        track.appendChild(slide);
    });

    // Reiniciar posición
    currentSlide = 0;
    updateCarousel();
    startAutoSlide();
}

function moveSlide(direction) {
    const track = document.getElementById("carousel-track");
    const totalSlides = track.children.length;
    
    currentSlide += direction;

    // Lógica de bucle infinito
    if (currentSlide < 0) {
        currentSlide = totalSlides - 1;
    } else if (currentSlide >= totalSlides) {
        currentSlide = 0;
    }

    updateCarousel();
    resetAutoSlide(); // Reiniciar el temporizador si el usuario toca las flechas
}

function updateCarousel() {
    const track = document.getElementById("carousel-track");
    // Movemos el track usando translateX según el índice actual
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
}

function startAutoSlide() {
    clearInterval(carouselInterval);
    carouselInterval = setInterval(() => moveSlide(1), 5000); // Cambio cada 5 segundos
}

function resetAutoSlide() {
    clearInterval(carouselInterval);
    startAutoSlide();
}

function startCarousel() {
    const track = document.getElementById("carousel-track");
    let index = 0;
    const slides = track.children;
    const total = slides.length;
    setInterval(() => {
        slides[index].style.opacity = 0;
        index = (index + 1) % total;
        slides[index].style.opacity = 1;
    }, 4000);
}

// --- CART ---
function addToCart(id) {
    const p = state.products.find(x => x.id === id);
    const item = state.cart.find(x => x.id === id);
    
    if (item) {
        if (item.quantity < p.stock) item.quantity++;
        else return toast("No hay más stock", "error");
    } else {
        state.cart.push({ ...p, quantity: 1 });
    }
    saveCart(); renderCart(); toast("Agregado al carrito", "success");
}

function renderCart() {
    const list = document.getElementById("cart-items");
    list.innerHTML = "";
    let total = 0;
    
    state.cart.forEach(i => {
        total += i.price * i.quantity;
        list.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #eee;">
                <div><b>${i.name}</b><br>$${i.price} x ${i.quantity}</div>
                <div>
                    <button onclick="modQty(${i.id}, -1)">-</button>
                    <button onclick="modQty(${i.id}, 1)">+</button>
                </div>
            </div>
        `;
    });
    document.getElementById("cart-total").innerText = `$${total}`;
    document.getElementById("cart-count").innerText = state.cart.reduce((a,b)=>a+b.quantity,0);
}

function modQty(id, d) {
    const item = state.cart.find(x => x.id === id);
    const p = state.products.find(x => x.id === id);
    item.quantity += d;
    if (item.quantity > p.stock) item.quantity = p.stock;
    if (item.quantity <= 0) state.cart = state.cart.filter(x => x.id !== id);
    saveCart(); renderCart();
}

async function checkout() {
    if (!state.user) return openModal("login-modal");
    try {
        const order = {
            customer_email: state.user.email,
            items: state.cart.map(i => ({ product_id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
            total: state.cart.reduce((a,b)=>a+b.price*b.quantity,0)
        };
        await api("/orders", "POST", order);
        state.cart = []; saveCart(); renderCart(); loadProducts();
        toast("Pedido Exitoso!", "success"); toggleCart();
    } catch(e) { toast(e.message, "error"); }
}

// --- AUTH ---
async function login() {
    const u = document.getElementById("log-user").value;
    const p = document.getElementById("log-pass").value;
    try {
        const data = await api("/login", "POST", { identifier: u, password: p });
        state.user = data.user; state.token = data.access_token;
        saveSession(); updateAuthUI(); closeModal("login-modal");
        toast(`Hola ${state.user.name}`, "success");
    } catch { toast("Error de credenciales", "error"); }
}

function logout() {
    state.user = null; state.token = null;
    localStorage.removeItem("dw_sess"); location.reload();
}

function updateAuthUI() {
    if (state.user) {
        document.getElementById("guest-nav").style.display = "none";
        document.getElementById("user-nav").style.display = "flex";
        document.getElementById("user-greeting").innerText = `Hola, ${state.user.name}`;
        if(state.user.role === "admin") document.getElementById("admin-link").classList.remove("hidden");
    } else {
        document.getElementById("guest-nav").style.display = "block";
        document.getElementById("user-nav").style.display = "none";
    }
}

// --- ADMIN ---
function toggleAdmin() {
    document.getElementById("admin-panel").classList.toggle("hidden");
    document.getElementById("main-app").classList.toggle("hidden");
    if(!document.getElementById("admin-panel").classList.contains("hidden")) loadAdminTable();
}
async function loadAdminTable() {
    const b = document.getElementById("adm-table"); b.innerHTML = "";
    state.products.forEach(p => {
        b.innerHTML += `<tr><td>${p.id}</td><td>${p.name}</td><td>${p.stock}</td>
        <td><button onclick="addStock(${p.id})">+ Stock</button></td></tr>`;
    });
}
async function addStock(id) {
    const qty = prompt("Cantidad a agregar:");
    if(qty) {
        await api(`/admin/stock/${id}`, "POST", { quantity: parseInt(qty) });
        loadProducts(); loadAdminTable(); toast("Stock actualizado");
    }
}

// --- UTILS ---
function toast(msg, type="info") {
    const t = document.createElement("div");
    t.style.background = type==="error" ? "#e53e3e" : "#38a169";
    t.style.color = "white"; t.style.padding = "15px"; t.style.borderRadius = "8px";
    t.style.marginBottom = "10px"; t.innerText = msg;
    document.getElementById("toast-box").appendChild(t);
    setTimeout(() => t.remove(), 3000);
}
function openModal(id) { document.getElementById(id).style.display = "flex"; }
function closeModal(id) { document.getElementById(id).style.display = "none"; }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.style.display = "none"); }
function toggleCart() { 
    const sb = document.getElementById("cart-sidebar");
    sb.style.right = sb.style.right === "0px" ? "-400px" : "0px"; 
}
function saveSession() { localStorage.setItem("dw_sess", JSON.stringify({u:state.user, t:state.token})); }
function loadSession() { const s = JSON.parse(localStorage.getItem("dw_sess")); if(s) { state.user=s.u; state.token=s.t; updateAuthUI(); } }
function saveCart() { localStorage.setItem("dw_cart", JSON.stringify(state.cart)); }
function loadCartFromStorage() { const c = JSON.parse(localStorage.getItem("dw_cart")); if(c) { state.cart=c; renderCart(); } }