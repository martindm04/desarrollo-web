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
            <div class="card-img"><img src="${p.image.startsWith('http') ? p.image : 'http://127.0.0.1:8000/static/images/' + p.image}" ...></div>
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

// --- HISTORIAL DE PEDIDOS ---
async function openOrderHistory() {
    if (!state.user) return toast("Debes iniciar sesión para ver tus pedidos", "error");

    try {
        // Pedimos los pedidos al backend
        const orders = await api(`/orders/user/${state.user.email}`);
        
        const tbody = document.getElementById("history-body");
        const noHistory = document.getElementById("no-history");
        
        if (tbody) tbody.innerHTML = ""; // Limpiar tabla anterior

        if (orders.length === 0) {
            if (noHistory) noHistory.classList.remove("hidden");
        } else {
            if (noHistory) noHistory.classList.add("hidden");
            
            // Dibujar cada pedido en la tabla
            orders.forEach(o => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="padding:10px; font-weight:bold;">#${o.id.slice(-6)}</td>
                    <td>$${o.total.toLocaleString('es-CL')}</td>
                    <td><span class="badge" style="background:#48bb78; position:static;">${o.status}</span></td>
                    <td style="font-size:0.9rem;">
                        ${o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
        openModal("history-modal");
    } catch (e) {
        console.error(e);
        toast("Error al cargar el historial", "error");
    }
}

// --- PANEL DE ADMINISTRACIÓN ---
function toggleAdminPanel() {
    const adminPanel = document.getElementById("admin-panel");
    const mainApp = document.getElementById("main-app");
    
    if (!adminPanel || !mainApp) return;

    if (adminPanel.classList.contains("hidden")) {
        // MOSTRAR PANEL
        adminPanel.classList.remove("hidden");
        adminPanel.style.display = "block"; // Asegurar visibilidad
        mainApp.classList.add("hidden");    // Ocultar tienda normal
        loadAdminTable();                   // Cargar datos
    } else {
        // OCULTAR PANEL
        adminPanel.classList.add("hidden");
        adminPanel.style.display = "none";
        mainApp.classList.remove("hidden");
    }
}

let salesChartInstance = null;

function switchTab(tabName) {
    // Gestión de clases CSS
    document.getElementById("view-products").classList.remove("active");
    document.getElementById("view-sales").classList.remove("active");
    
    // Gestión visual de los botones (opcional, para que se ilumine el activo)
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach(t => t.classList.remove("active"));
    
    if (tabName === 'products') {
        document.getElementById("view-products").classList.add("active");
        tabs[0].classList.add("active");
    } else if (tabName === 'sales') {
        document.getElementById("view-sales").classList.add("active");
        tabs[1].classList.add("active");
        loadSalesMetrics(); // <--- CARGAR DATOS AL CLICKEAR
    }
}

async function loadSalesMetrics() {
    try {
        // 1. Obtener todas las órdenes
        const orders = await api("/orders");
        
        // 2. Calcular KPIs
        const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
        const totalOrders = orders.length;
        const avgTicket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

        document.getElementById("kpi-total").innerText = `$${totalRevenue.toLocaleString('es-CL')}`;
        document.getElementById("kpi-count").innerText = totalOrders;
        document.getElementById("kpi-avg").innerText = `$${avgTicket.toLocaleString('es-CL')}`;

        // 3. Preparar datos para el Gráfico (Agrupar ventas por producto)
        // Creamos un diccionario: { "Empanada Pino": 50, "Bebida": 20 ... }
        const productSales = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                if (productSales[item.name]) {
                    productSales[item.name] += item.quantity;
                } else {
                    productSales[item.name] = item.quantity;
                }
            });
        });

        // Separar etiquetas (nombres) y datos (cantidades)
        const labels = Object.keys(productSales);
        const data = Object.values(productSales);

        // 4. Renderizar Chart.js
        const ctx = document.getElementById('salesChart').getContext('2d');
        
        // Si ya existe un gráfico previo, destruirlo para no sobreponer
        if (salesChartInstance) salesChartInstance.destroy();

        salesChartInstance = new Chart(ctx, {
            type: 'bar', // Tipo de gráfico: barras
            data: {
                labels: labels,
                datasets: [{
                    label: 'Unidades Vendidas',
                    data: data,
                    backgroundColor: 'rgba(211, 47, 47, 0.7)', // Color rojo corporativo
                    borderColor: 'rgba(211, 47, 47, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Productos Más Vendidos' }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

    } catch (e) {
        console.error(e);
        toast("Error cargando métricas", "error");
    }
}

async function loadAdminTable() {
    const tbody = document.getElementById("adm-table");
    if (!tbody) return;
    
    tbody.innerHTML = "<tr><td colspan='5'>Cargando...</td></tr>";
    
    await loadProducts(); // Refrescar datos del servidor
    tbody.innerHTML = ""; // Limpiar mensaje de carga

    state.products.forEach(p => {
        tbody.innerHTML += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px;">${p.id}</td>
                <td style="display:flex; align-items:center; gap:10px;">
                    <img src="${p.image}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">
                    ${p.name}
                </td>
                <td>$${p.price.toLocaleString('es-CL')}</td>
                <td style="font-weight:bold; color:${p.stock < 10 ? 'red' : 'green'}">${p.stock}</td>
                <td>
                    <button class="btn-primary" style="padding:5px 10px; font-size:0.8rem;" onclick="addStock(${p.id})">+ Stock</button>
                    <button class="btn-secondary" style="padding:5px 10px; font-size:0.8rem; background:#e53e3e; color:white;" onclick="deleteProduct(${p.id})">🗑️</button>
                </td>
            </tr>
        `;
    });
}

// Funciones del formulario de Admin
async function saveProduct() {
    const id = parseInt(document.getElementById("adm-id").value);
    const name = document.getElementById("adm-name").value;
    const cat = document.getElementById("adm-cat").value;
    const price = parseInt(document.getElementById("adm-price").value);
    const stock = parseInt(document.getElementById("adm-stock").value);
    const img = document.getElementById("adm-img").value;

    if (!id || !name || !price) return toast("Faltan datos obligatorios", "error");

    const product = { id, name, category: cat, price, stock, image: img || "https://via.placeholder.com/150" };

    try {
        await api("/products", "POST", product);
        toast("Producto creado correctamente", "success");
        clearForm();
        loadAdminTable();
    } catch (e) {
        toast(e.message || "Error al crear producto (¿ID repetido?)", "error");
    }
}

function clearForm() {
    document.getElementById("adm-id").value = "";
    document.getElementById("adm-name").value = "";
    document.getElementById("adm-price").value = "";
    document.getElementById("adm-stock").value = "";
    document.getElementById("adm-img").value = "";
}

// Variable temporal para saber qué producto estamos editando
let currentEditingProductId = null;

// Paso 1: Abrir el modal bonito
function addStock(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;

    currentEditingProductId = id;
    
    // Llenar datos en el modal
    document.getElementById("stock-prod-name").innerText = `Agregando stock a: ${p.name}`;
    document.getElementById("new-stock-qty").value = 10; // Valor por defecto
    document.getElementById("new-stock-qty").focus();
    
    openModal("stock-modal");
}

// Paso 2: Confirmar la acción
async function confirmStockUpdate() {
    const qtyInput = document.getElementById("new-stock-qty");
    const qty = parseInt(qtyInput.value);

    if (!qty || qty <= 0) return toast("Ingresa una cantidad válida", "error");

    try {
        await api(`/admin/stock/${currentEditingProductId}`, "POST", { quantity: qty });
        toast("Inventario actualizado correctamente", "success");
        closeModal("stock-modal");
        loadAdminTable(); // Refrescar la tabla de fondo
    } catch (e) {
        toast("Error al actualizar stock", "error");
    }
}

async function deleteProduct(id) {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;
    
    try {
        await api(`/products/${id}`, "DELETE");
        toast("Producto eliminado", "success");
        loadAdminTable();
    } catch (e) {
        toast("Error al eliminar", "error");
    }
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
