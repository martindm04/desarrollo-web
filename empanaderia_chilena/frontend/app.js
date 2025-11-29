const API = "http://127.0.0.1:8000"; // CORRECCIÓN: Puerto del Backend, no de Mongo
console.log(`📡 Conectando a la API: ${API}`);

let state = { user: null, token: null, products: [], cart: [] };
let carouselInterval = null;
let isEditingId = null;
let currentEditingProductId = null;
let salesChartInstance = null;

document.addEventListener("DOMContentLoaded", async () => {
    loadSession();
    loadCartFromStorage();
    renderCart();
    renderSkeletons();

    await loadProducts();

    // Listeners Globales
    document.addEventListener("keydown", e => { if(e.key === "Escape") closeModals(); });

    const searchInput = document.getElementById("search");
    if(searchInput) {
        searchInput.addEventListener("keyup", (e) => {
            if(e.target.value.length > 0) renderGrid();
            else showHome();
        });
    }
});

// --- API CLIENT ---
async function api(endpoint, method="GET", body=null) {
    const headers = { "Content-Type": "application/json" };
    if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
    
    try {
        // Aseguramos que la URL esté bien formada
        const url = `${API}${endpoint}`;
        console.log(`📞 Fetching: ${url}`); // Debug para ver en consola

        const res = await fetch(url, {
            method, headers, body: body ? JSON.stringify(body) : null
        });

        const data = await res.json();

        if (!res.ok) {
            if (res.status === 429) {
                throw new Error("⛔ Demasiados intentos. Por favor espera 1 minuto.");
            }
            throw new Error(data.detail || "Error en la petición");
        }
        return data;
    } catch (e) {
        console.error("Error API:", e);
        throw e;
    }
}

// --- UI HELPERS ---

function renderSkeletons() {
    const container = document.getElementById("home-view");
    if(!container) return;
    container.innerHTML = '<div class="shelf-container" style="overflow:hidden;">' + 
        Array(4).fill('<div class="card-skeleton"><div class="skeleton sk-img"></div><div class="skeleton sk-line"></div><div class="skeleton sk-line" style="width:60%"></div><div class="skeleton sk-btn"></div></div>').join('') + 
        '</div>';
}

function createCardHTML(p) {
    // Lógica robusta para URLs de imágenes
    let imgUrl = p.image;
    
    if (!imgUrl) {
        imgUrl = "https://via.placeholder.com/150?text=Sin+Imagen";
    } else if (!imgUrl.startsWith('http')) {
        // Si viene con barra al inicio, la quitamos para evitar dobles barras si API ya tiene
        const cleanPath = imgUrl.startsWith('/') ? imgUrl.substring(1) : imgUrl;
        // Si la ruta ya incluye 'static', no lo repetimos si API no lo tiene
        // Asumimos que API es la base (http://localhost:8000) y el path es static/images/...
        imgUrl = `${API}/${cleanPath}`;
    }

    const hasStock = p.stock > 0;

    return `
        <div class="card">
            <div class="card-img">
                <span class="badge ${p.category}">${p.category}</span>
                <img src="${imgUrl}" onerror="this.src='https://via.placeholder.com/150?text=Error'" loading="lazy" alt="${p.name}">
            </div>
            <div class="card-info">
                <h3>${p.name}</h3>
                <div class="card-footer">
                    <div class="price-tag">$${p.price.toLocaleString('es-CL')}</div>
                    <small style="font-size:0.7rem; color:${hasStock ? '#718096' : '#e53e3e'}">
                        ${hasStock ? 'Disponible' : 'Agotado'}
                    </small>
                </div>
                <button 
                    class="btn-add-mini ${!hasStock ? 'disabled' : ''}" 
                    onclick="${hasStock ? `addToCart(${p.id})` : ''}"
                    aria-label="Agregar al carrito"
                >
                    ${hasStock ? '+' : '×'}
                </button>
            </div>
        </div>
    `;
}

// --- LÓGICA DE PRODUCTOS ---

async function loadProducts() {
    try {
        state.products = await api("/products");
        renderHome();
        initCarousel(); // Hero Carousel
    } catch (e) {
        console.error("Fallo al cargar productos:", e);
        // Mostrar mensaje de error en la UI
        const container = document.getElementById("home-view");
        if(container) container.innerHTML = `<div style="text-align:center; padding:20px; color:red;">Error de conexión con el servidor (${API}).<br>Revisa que el backend esté corriendo.</div>`;
    }
}

function renderHome() {
    const container = document.getElementById("home-view");
    const gridView = document.getElementById("full-grid-view");
    if(!container) return;

    container.classList.remove("hidden");
    if(gridView) gridView.classList.add("hidden");
    container.innerHTML = "";

    const categories = [
        { id: 'horno', title: '🔥 Empanadas de Horno' },
        { id: 'frita', title: '🍳 Empanadas Fritas' },
        { id: 'bebida', title: '🥤 Bebidas Refrescantes' },
        { id: 'acompañamiento', title: '🍟 Acompañamientos' }
    ];

    categories.forEach(cat => {
        const products = state.products.filter(p => p.category === cat.id);
        if (products.length > 0) {
            const section = document.createElement("section");
            section.innerHTML = `
                <div class="category-header">
                    <div class="category-title">${cat.title}</div>
                    <div class="view-all-link" onclick="showFullCatalog('${cat.id}')">Ver todo ></div>
                </div>
                <div class="shelf-container">
                    ${products.map(p => createCardHTML(p)).join('')}
                </div>
            `;
            container.appendChild(section);
        }
    });
    
    // Botón ver todo al final
    container.innerHTML += `
        <div style="text-align:center; margin: 40px 0; padding-bottom: 40px;">
            <button class="btn-floating-all" onclick="showFullCatalog('all')">
                📜 Ver Menú Completo
            </button>
        </div>
    `;
}

function showFullCatalog(filterCat = 'all') {
    document.getElementById("home-view").classList.add("hidden");
    document.getElementById("full-grid-view").classList.remove("hidden");
    renderGrid(filterCat);
}

function renderGrid(filterCat = 'all') {
    const grid = document.getElementById("grid");
    const searchInput = document.getElementById("search");
    const term = searchInput ? searchInput.value.toLowerCase() : "";
    
    // Título dinámico
    const title = document.getElementById("grid-title");
    if(title) title.innerText = filterCat === 'all' ? (term ? "Resultados de búsqueda" : "Todo nuestro Menú") : filterCat.toUpperCase();

    grid.innerHTML = "";
    
    const filtered = state.products.filter(p => {
        const matchesTerm = p.name.toLowerCase().includes(term);
        const matchesCat = filterCat === 'all' || p.category === filterCat;
        return matchesTerm && matchesCat;
    });

    const emptyState = document.getElementById("empty-state");
    if(filtered.length === 0) {
        if(emptyState) emptyState.classList.remove("hidden");
    } else {
        if(emptyState) emptyState.classList.add("hidden");
    }

    filtered.forEach(p => {
        // Reutilizamos el estilo de tarjeta pero en wrapper grid
        // Nota: createCardHTML devuelve un string con la clase 'card'. 
        // En el CSS .grid .card tiene estilos específicos para adaptarse.
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = createCardHTML(p);
        grid.appendChild(tempDiv.firstElementChild);
    });
}

function showHome() {
    const searchInput = document.getElementById("search");
    if(searchInput) searchInput.value = "";
    renderHome();
}

// --- CARRUSEL HERO ---
function initCarousel() {
    const track = document.getElementById("carousel-track");
    const container = document.getElementById("hero-carousel");
    
    // Filtrar productos con imagen y stock
    const featured = state.products.filter(p => p.stock > 0).slice(0, 5);
    
    if (featured.length === 0 || !track) {
        if(container) container.classList.add("hidden");
        return;
    }
    
    container.classList.remove("hidden");
    
    // Construir slides
    track.innerHTML = featured.map(p => {
        let img = p.image.startsWith('http') ? p.image : `${API}${p.image.startsWith('/')?'':'/'}${p.image}`;
        return `
            <div class="carousel-slide" style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);">
                <div class="slide-content">
                    <span class="badge ${p.category}" style="position:static; display:inline-block; margin-bottom:5px;">${p.category}</span>
                    <h2>${p.name}</h2>
                    <h3 style="color:#555; margin-bottom:15px;">$${p.price.toLocaleString('es-CL')}</h3>
                    <button class="btn-primary" onclick="addToCart(${p.id})" style="width:auto; padding:8px 20px;">Lo quiero</button>
                </div>
                <img src="${img}" class="slide-img">
            </div>
        `;
    }).join('');

    // Iniciar animación simple
    let index = 0;
    if(carouselInterval) clearInterval(carouselInterval);
    
    // Mostrar el primero
    showSlide(0);

    carouselInterval = setInterval(() => {
        index = (index + 1) % featured.length;
        showSlide(index);
    }, 4000);

    function showSlide(i) {
        track.style.transform = `translateX(-${i * 100}%)`;
    }
}

// --- CARRITO & MODALS ---
let tempQty = 1;
let tempProduct = null;

function addToCart(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    if (p.stock <= 0) return toast("Producto agotado", "error");

    tempProduct = p;
    tempQty = 1;

    document.getElementById("qty-prod-name").innerText = p.name;
    
    let imgUrl = p.image;
    if (!imgUrl.startsWith('http')) {
        imgUrl = `${API}${imgUrl.startsWith('/')?'':'/'}${imgUrl}`;
    }
    document.getElementById("qty-prod-img").src = imgUrl;
    
    updateModalUI();
    openModal("qty-modal");
}

function adjustModalQty(delta) {
    if (!tempProduct) return;
    const newQty = tempQty + delta;
    if (newQty < 1) return;
    if (newQty > tempProduct.stock) return toast(`Solo quedan ${tempProduct.stock} unidades`, "error");
    tempQty = newQty;
    updateModalUI();
}

function updateModalUI() {
    document.getElementById("qty-val").innerText = tempQty;
    document.getElementById("qty-subtotal").innerText = `$${(tempProduct.price * tempQty).toLocaleString('es-CL')}`;
}

function confirmAdd(goToCheckout) {
    if (!tempProduct) return;

    const item = state.cart.find(x => x.id === tempProduct.id);
    
    if (item) {
        if (item.quantity + tempQty > tempProduct.stock) {
            return toast("No puedes agregar más: excede el stock disponible", "error");
        }
        item.quantity += tempQty;
    } else {
        state.cart.push({ ...tempProduct, quantity: tempQty });
    }

    saveCart();
    renderCart();
    closeModal("qty-modal");

    const cartIcon = document.querySelector(".cart-icon");
    if(cartIcon) {
        cartIcon.classList.add("cart-shake");
        setTimeout(() => cartIcon.classList.remove("cart-shake"), 500);
    }

    if (goToCheckout) {
        openCheckout();
    } else {
        toast(`Agregaste ${tempQty}x ${tempProduct.name}`, "success");
    }
}

function renderCart() {
    const list = document.getElementById("cart-items");
    const cartCount = document.getElementById("cart-count");
    if(!list) return;
    
    list.innerHTML = "";
    let total = 0;
    
    state.cart.forEach(i => {
        total += i.price * i.quantity;
        list.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                <div><b>${i.name}</b><br>$${i.price.toLocaleString('es-CL')} x ${i.quantity}</div>
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
    if(cartCount) cartCount.innerText = count;
    
    const net = Math.round(total / 1.19);
    const tax = total - net;
    
    const elNet = document.getElementById("cart-net");
    const elTax = document.getElementById("cart-tax");
    if(elNet) elNet.innerText = `$${net.toLocaleString('es-CL')}`;
    if(elTax) elTax.innerText = `$${tax.toLocaleString('es-CL')}`;
}

function modQty(id, d) {
    const item = state.cart.find(x => x.id === id);
    const p = state.products.find(x => x.id === id); // Necesitamos el producto para saber el stock max
    if(!item) return;

    // Si no tenemos el producto en la lista general (raro), usamos el del carrito pero sin validar stock maximo del backend
    const maxStock = p ? p.stock : 999; 

    item.quantity += d;
    
    if (item.quantity > maxStock) {
        item.quantity = maxStock;
        toast("Stock máximo alcanzado", "error");
    }
    
    if (item.quantity <= 0) {
        state.cart = state.cart.filter(x => x.id !== id);
    }
    
    saveCart(); 
    renderCart();
}

function toggleCart() {
    const cart = document.getElementById("cart-sidebar");
    const overlay = document.getElementById("cart-overlay");

    if (cart.classList.contains("open")) {
        cart.classList.remove("open");
        if(overlay) overlay.style.display = "none";
    } else {
        cart.classList.add("open");
        if(overlay) overlay.style.display = "block";
    }
}

function openCheckout() {
    if (state.cart.length === 0) return toast("Tu carrito está vacío", "error");
    if (!state.user) {
        toast("Inicia sesión para continuar", "info");
        return openModal("login-modal");
    }

    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById("chk-total").innerText = `$${total.toLocaleString('es-CL')}`;
    document.getElementById("chk-email").innerText = state.user.email;

    toggleCart(); 
    openModal("checkout-modal");
}

async function processPayment() {
    try {
        const order = {
            customer_email: state.user.email,
            items: state.cart.map(i => ({ 
                product_id: i.id, 
                name: i.name, 
                price: i.price, 
                quantity: i.quantity 
            })),
            total: state.cart.reduce((a,b)=>a+b.price*b.quantity,0)
        };
        
        // Simular espera
        const btn = document.querySelector("#checkout-modal .btn-primary");
        const originalText = btn.innerText;
        btn.innerText = "Procesando...";
        btn.disabled = true;

        await api("/orders", "POST", order);
        
        // Éxito
        state.cart = []; 
        saveCart(); 
        renderCart(); 
        await loadProducts(); // Recargar productos para actualizar stock visual
        
        closeModal("checkout-modal");
        toast("¡Pedido confirmado exitosamente! 🥟", "success");

    } catch(e) { 
        toast(e.message, "error"); 
    } finally {
        const btn = document.querySelector("#checkout-modal .btn-primary");
        if(btn) {
            btn.innerText = "Pagar Ahora";
            btn.disabled = false;
        }
    }
}

// --- AUTH ---
async function login() {
    const u = document.getElementById("login-user").value;
    const p = document.getElementById("login-pass").value;
    
    if(!u || !p) return toast("Datos incompletos", "error");

    try {
        const data = await api("/login", "POST", { identifier: u, password: p });
        state.user = data.user; 
        state.token = data.access_token;
        saveSession(); 
        updateAuthUI(); 
        closeModal("login-modal");
        toast(`¡Hola ${state.user.name}!`, "success");
    } catch (e) { 
        toast(e.message || "Error de login", "error"); 
    }
}

async function register() {
    const name = document.getElementById("reg-name").value;
    const email = document.getElementById("reg-email").value;
    const pass = document.getElementById("reg-pass").value;

    if (!name || !email || !pass) return toast("Completa todo", "error");
    if (pass.length < 8) return toast("Mínimo 8 caracteres", "error");

    try {
        await api("/register", "POST", { name, email, password: pass });
        toast("Cuenta creada. Inicia sesión.", "success");
        closeModal("register-modal");
        openModal("login-modal");
    } catch (e) { 
        toast(e.message || "Error al registrar", "error"); 
    }
}

function logout() {
    state.user = null; state.token = null;
    localStorage.removeItem("dw_sess"); 
    updateAuthUI();
    toast("Sesión cerrada");
    window.location.reload();
}

// --- ADMIN ---
async function loadAdminTable() {
    const tbody = document.getElementById("adm-table");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';

    try {
        // Siempre refrescar productos al abrir admin
        state.products = await api("/products");

        tbody.innerHTML = "";
        state.products.forEach(p => {
            const tr = document.createElement("tr");
            let img = p.image.startsWith('http') ? p.image : `${API}${p.image.startsWith('/')?'':'/'}${p.image}`;
            
            tr.innerHTML = `
                <td><img src="${img}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;"></td>
                <td>${p.name}</td>
                <td>$${p.price.toLocaleString('es-CL')}</td>
                <td style="font-weight:bold; color:${p.stock<10?'red':'green'}">${p.stock}</td>
                <td>
                    <button onclick="editProduct(${p.id})" class="btn-secondary" style="padding:4px 8px; margin-right:5px;">✏️</button>
                    <button onclick="deleteProduct(${p.id})" class="btn-primary" style="padding:4px 8px; background:#E53E3E;">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Error cargando datos</td></tr>';
    }
}

function toggleAdminPanel() {
    const admin = document.getElementById("admin-panel");
    if (admin.classList.contains("hidden")) {
        admin.classList.remove("hidden");
        admin.classList.add("open"); // Para animación CSS si existe
        loadAdminTable();
    } else {
        admin.classList.add("hidden");
        admin.classList.remove("open");
    }
}

function editProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;

    isEditingId = id;
    document.getElementById("adm-id").value = p.id;
    document.getElementById("adm-id").disabled = true;
    document.getElementById("adm-name").value = p.name;
    document.getElementById("adm-cat").value = p.category;
    document.getElementById("adm-price").value = p.price;
    document.getElementById("adm-stock").value = p.stock;
    document.getElementById("adm-img-url").value = p.image;
    
    const preview = document.getElementById("preview-img");
    if(preview) {
        let imgUrl = p.image.startsWith('http') ? p.image : `${API}${p.image.startsWith('/')?'':'/'}${p.image}`;
        preview.src = imgUrl;
        preview.style.display = "block";
    }
    
    // Scroll al formulario
    document.querySelector("#view-products").scrollIntoView({behavior: 'smooth'});
}

async function saveProduct() {
    const id = parseInt(document.getElementById("adm-id").value);
    const name = document.getElementById("adm-name").value;
    const cat = document.getElementById("adm-cat").value;
    const price = parseInt(document.getElementById("adm-price").value);
    const stock = parseInt(document.getElementById("adm-stock").value);
    const img = document.getElementById("adm-img-url").value || "placeholder.jpg";

    if (!id || !name || !price) return toast("Faltan datos", "error");

    const productData = { id, name, category: cat, price, stock, image: img };

    try {
        if (isEditingId) {
            await api(`/products/${isEditingId}`, "PUT", productData);
            toast("Actualizado", "success");
        } else {
            await api("/products", "POST", productData);
            toast("Creado", "success");
        }
        clearForm();
        loadAdminTable();
        loadProducts(); // Refrescar vista usuario
    } catch (e) {
        toast(e.message || "Error al guardar", "error");
    }
}

async function deleteProduct(id) {
    if(!confirm("¿Eliminar producto?")) return;
    try {
        await api(`/products/${id}`, "DELETE");
        toast("Eliminado", "success");
        loadAdminTable();
        loadProducts();
    } catch(e) { toast("Error al eliminar", "error"); }
}

function clearForm() {
    isEditingId = null;
    document.getElementById("adm-id").value = "";
    document.getElementById("adm-id").disabled = false;
    document.getElementById("adm-name").value = "";
    document.getElementById("adm-price").value = "";
    document.getElementById("adm-stock").value = "";
    document.getElementById("adm-img-url").value = "";
    const preview = document.getElementById("preview-img");
    if(preview) preview.style.display = "none";
}

async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    try {
        toast("Subiendo imagen...", "info");
        const res = await fetch(`${API}/upload`, { method: "POST", body: formData });
        if(!res.ok) throw new Error("Error subida");
        const data = await res.json();
        document.getElementById("adm-img-url").value = data.url;
        
        const preview = document.getElementById("preview-img");
        if(preview) {
            preview.src = `${API}${data.url}`;
            preview.style.display = "block";
        }
        toast("Imagen lista", "success");
    } catch(e) {
        toast("Error al subir", "error");
    }
}

// --- UTILS ---
function updateAuthUI() {
    const authLinks = document.getElementById("auth-links");
    const userInfo = document.getElementById("user-info");
    const adminLink = document.getElementById("admin-link");

    if (state.user) {
        if(authLinks) authLinks.classList.add("hidden");
        if(userInfo) {
            userInfo.classList.remove("hidden");
            userInfo.style.display = "flex";
        }
        document.getElementById("user-name-display").innerText = state.user.name;
        
        if(state.user.role === 'admin' && adminLink) {
            adminLink.classList.remove("hidden");
        } else if (adminLink) {
            adminLink.classList.add("hidden");
        }
    } else {
        if(authLinks) authLinks.classList.remove("hidden");
        if(userInfo) userInfo.classList.add("hidden");
        if(adminLink) adminLink.classList.add("hidden");
    }
}

function openModal(id) { 
    const el = document.getElementById(id);
    if(el) {
        el.classList.remove("hidden");
        el.style.display = "flex";
    }
}
function closeModal(id) { 
    const el = document.getElementById(id);
    if(el) {
        el.classList.add("hidden");
        el.style.display = "none";
    }
}
function closeModals() { 
    document.querySelectorAll('.modal').forEach(m => {
        m.classList.add("hidden");
        m.style.display = "none";
    }); 
}
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

function saveSession() { localStorage.setItem("dw_sess", JSON.stringify({u:state.user, t:state.token})); }
function loadSession() { 
    const s = JSON.parse(localStorage.getItem("dw_sess")); 
    if(s) { state.user=s.u; state.token=s.t; updateAuthUI(); } 
}
function saveCart() { localStorage.setItem("dw_cart", JSON.stringify(state.cart)); }
function loadCartFromStorage() { 
    const c = JSON.parse(localStorage.getItem("dw_cart")); 
    if(c) state.cart = c; 
}
