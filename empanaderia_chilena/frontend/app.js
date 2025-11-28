const API_PORT = 8000;
const API_HOST = window.location.hostname;
const API = `http://${API_HOST}:${API_PORT}`; 

console.log(`📡 Conectando a: ${API}`);

let state = { user: null, token: null, products: [], cart: [] };

document.addEventListener("DOMContentLoaded", async () => {

    document.getElementById("full-grid-view").classList.add("hidden");
    const adminPanel = document.getElementById("admin-panel");
    if(adminPanel) adminPanel.classList.add("hidden");

    loadSession();
    loadCartFromStorage();
    renderCart();

    try {
        state.products = await api("/products");
        renderHome();
    } catch (e) {
        console.error("Error cargando productos iniciales:", e);
    }

    const searchInput = document.getElementById("search");
    if(searchInput) {
        searchInput.value = ""; 
        searchInput.addEventListener("keyup", (e) => {
            if(e.target.value.length > 0) renderGrid();
            else showHome();
        });
    }
});

async function api(endpoint, method="GET", body=null) {
    const headers = { "Content-Type": "application/json" };
    if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
    
    try {
        const res = await fetch(`${API}${endpoint}`, {
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
        throw e;
    }
}

async function loadProducts() {
    try {
        state.products = await api("/products");
        renderHome();
        initCarousel();
    } catch (e) { 
        console.error(e);
        toast("Error conectando con el servidor.", "error"); 
    }
}

function createCardHTML(p) {
    let imgUrl = p.image;

    if (imgUrl.startsWith('/')) {
        imgUrl = `${API}${imgUrl}`;
    } else if (!imgUrl.startsWith('http')) {
        imgUrl = `${API}/static/images/${imgUrl}`;
    }

    const hasStock = p.stock > 0;
    
    return `
        <div class="card-img">
            <span class="badge ${p.category}">${p.category}</span>
            <img src="${imgUrl}" onerror="this.src='https://via.placeholder.com/150?text=Sin+Foto'" loading="lazy" alt="${p.name}">
        </div>
        <div class="card-info">
            <h3>${p.name}</h3>
            <div class="card-footer">
                <div class="price-info">
                    <div class="price-tag">$${p.price.toLocaleString('es-CL')}</div>
                </div>
                <button class="btn-add-mini ${!hasStock ? 'disabled' : ''}" 
                    onclick="${hasStock ? `addToCart(${p.id})` : ''}">
                    ${hasStock ? '+' : '×'}
                </button>
            </div>
        </div>
    `;
}

function renderHome() {
    const container = document.getElementById("home-view");
    const gridView = document.getElementById("full-grid-view");
    
    if(!container) return;

    container.classList.remove("hidden");
    gridView.classList.add("hidden");
    container.innerHTML = "";

    const categories = [
        { id: 'horno', title: '🔥 Empanadas de Horno' },
        { id: 'frita', title: '🍳 Empanadas Fritas' },
        { id: 'bebida', title: '🥤 Bebidas Refrescantes' },
        { id: 'acompañamiento', title: '🍟 Acompañamientos & Salsas' }
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

    container.innerHTML += `
        <div style="text-align:center; margin: 40px 0; padding-bottom: 40px;">
            <button class="btn-floating-all" onclick="showFullCatalog('all')">
                📜 Ver Menú Completo
            </button>
        </div>
    `;
}

function showFullCatalog(filterCat = 'all') {
    const home = document.getElementById("home-view");
    const full = document.getElementById("full-grid-view");
    const title = document.getElementById("grid-title");
    
    home.classList.add("hidden");
    full.classList.remove("hidden");

    title.innerText = filterCat === 'all' ? "Todo nuestro Menú" : filterCat.toUpperCase();
    renderGrid(filterCat);
}

function showHome() {
    document.getElementById("search").value = "";
    renderHome();
}

function renderGrid(categoryFilter = 'all') {
    const grid = document.getElementById("grid");
    const term = document.getElementById("search").value.toLowerCase();
    
    if (term.length > 0) {
        document.getElementById("home-view").classList.add("hidden");
        document.getElementById("full-grid-view").classList.remove("hidden");
        document.getElementById("grid-title").innerText = `Resultados para "${term}"`;
    }

    grid.innerHTML = "";
    
    const filtered = state.products.filter(p => {
        const matchesTerm = p.name.toLowerCase().includes(term);
        const matchesCat = categoryFilter === 'all' || p.category === categoryFilter;
        return matchesTerm && matchesCat;
    });

    const emptyState = document.getElementById("empty-state");
    if(filtered.length === 0) {
        if(emptyState) emptyState.classList.remove("hidden");
    } else {
        if(emptyState) emptyState.classList.add("hidden");
    }

    filtered.forEach(p => {
        const card = document.createElement("div");
        card.className = `card ${p.stock === 0 ? 'out' : ''}`;
        card.innerHTML = createCardHTML(p);
        grid.appendChild(card);
    });
}

let carouselInterval;
let currentSlide = 1;

function initCarousel() {
    const track = document.getElementById("carousel-track");
    const container = document.getElementById("hero-carousel");

    const featured = state.products.filter(p => p.stock > 0 && p.image).slice(0, 5);
    
    if (featured.length === 0 || !track) return;
    container.classList.remove("hidden");

    const slidesHTML = featured.map(p => buildSlideHTML(p)).join('');
    const firstClone = buildSlideHTML(featured[0]);
    const lastClone = buildSlideHTML(featured[featured.length - 1]);

    track.innerHTML = lastClone + slidesHTML + firstClone;

    track.style.transform = `translateX(-100%)`;

    // Dots
    const dotsContainer = document.getElementById("carousel-dots");
    dotsContainer.innerHTML = featured.map((_, i) => 
        `<div class="dot ${i===0?'active':''}" id="dot-${i}"></div>`
    ).join('');

    startCarouselLoop(featured.length);
}

function buildSlideHTML(p) {
    let img = p.image.startsWith('http') ? p.image : `${API}${p.image}`;
    return `
        <div class="carousel-slide" style="background: linear-gradient(120deg, #fdfbfb 0%, #ebedee 100%);">
            <div class="slide-content">
                <span class="badge ${p.category}" style="position:static; margin-bottom:10px; display:inline-block;">${p.category}</span>
                <h2>${p.name}</h2>
                <h3 style="color:#555; margin-bottom:20px;">$${p.price.toLocaleString('es-CL')}</h3>
                <button class="btn-primary" onclick="addToCart(${p.id})" style="width:auto; padding:10px 30px;">¡Lo quiero!</button>
            </div>
            <img src="${img}" class="slide-img" style="max-height:200px; object-fit:contain;">
        </div>
    `;
}

function startCarouselLoop(totalRealSlides) {
    const track = document.getElementById("carousel-track");
    if(carouselInterval) clearInterval(carouselInterval);

    carouselInterval = setInterval(() => {
        currentSlide++;
        track.style.transition = "transform 0.5s ease-in-out";
        track.style.transform = `translateX(-${currentSlide * 100}%)`;

        if (currentSlide === totalRealSlides + 1) {
            setTimeout(() => {
                track.style.transition = "none";
                currentSlide = 1;
                track.style.transform = `translateX(-100%)`;
            }, 500);
        }

        updateDots(currentSlide, totalRealSlides);
    }, 4000);
}

function updateDots(idx, total) {
    let visualIndex = idx - 1;
    if (visualIndex < 0) visualIndex = total - 1;
    if (visualIndex >= total) visualIndex = 0;

    document.querySelectorAll(".dot").forEach(d => d.classList.remove("active"));
    const activeDot = document.getElementById(`dot-${visualIndex}`);
    if(activeDot) activeDot.classList.add("active");
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
        imgUrl = imgUrl.startsWith('/') ? `${API}${imgUrl}` : `${API}/static/images/${imgUrl}`;
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
    const subtotal = tempProduct.price * tempQty;
    document.getElementById("qty-subtotal").innerText = `$${subtotal.toLocaleString('es-CL')}`;
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
    const cartCount = document.getElementById("cart-count");
    if(cartCount) cartCount.innerText = count;
    
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

function toggleCart() {
    const cart = document.getElementById("cart-sidebar");
    const overlay = document.getElementById("cart-overlay");
    
    // Usamos toggle para añadir/quitar la clase 'open' que definimos en CSS
    if (cart.classList.contains("open")) {
        cart.classList.remove("open");
        if(overlay) overlay.style.display = "none";
    } else {
        cart.classList.add("open");
        if(overlay) overlay.style.display = "block";
    }
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

async function openOrderHistory() {
    if (!state.user) return toast("Debes iniciar sesión", "error");

    try {
        const orders = await api(`/orders/user/${state.user.email}`);
        const tbody = document.getElementById("history-body");
        const noHistory = document.getElementById("no-history");
        
        if (tbody) tbody.innerHTML = "";

        if (orders.length === 0) {
            if (noHistory) noHistory.classList.remove("hidden");
        } else {
            if (noHistory) noHistory.classList.add("hidden");
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
        toast("Error al cargar el historial", "error");
    }
}

function toggleAdminPanel() {
    const admin = document.getElementById("admin-panel");
    const mainApp = document.querySelector(".main-wrapper");
    const header = document.querySelector("header");
    const bottomNav = document.querySelector(".bottom-nav");

    const isOpen = admin.classList.contains("open");

    if (isOpen) {
        admin.classList.remove("open");
        setTimeout(() => admin.classList.add("hidden"), 300);
        
        mainApp.classList.remove("hidden");
        if(header) header.classList.remove("hidden");
        if(bottomNav) bottomNav.classList.remove("hidden");

    } else {
        admin.classList.remove("hidden");

        setTimeout(() => admin.classList.add("open"), 10);
        
        mainApp.classList.add("hidden");
        if(header) header.classList.add("hidden");
        if(bottomNav) bottomNav.classList.add("hidden");

        loadAdminTable();
    }
}

function switchTab(tabName) {
    document.getElementById("view-products").classList.remove("active");
    document.getElementById("view-sales").classList.remove("active");
    
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach(t => t.classList.remove("active"));
    
    if (tabName === 'products') {
        document.getElementById("view-products").classList.add("active");
        tabs[0].classList.add("active");
    } else if (tabName === 'sales') {
        document.getElementById("view-sales").classList.add("active");
        tabs[1].classList.add("active");
        loadSalesMetrics();
    }
}

async function loadSalesMetrics() {
    if (!state.user || state.user.role !== 'admin') return;
    try {
        const orders = await api("/orders");
        
        const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
        const totalOrders = orders.length;
        const avgTicket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

        document.getElementById("kpi-total").innerText = `$${totalRevenue.toLocaleString('es-CL')}`;
        document.getElementById("kpi-count").innerText = totalOrders;
        document.getElementById("kpi-avg").innerText = `$${avgTicket.toLocaleString('es-CL')}`;

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

        const labels = Object.keys(productSales);
        const data = Object.values(productSales);

        const ctx = document.getElementById('salesChart').getContext('2d');
        if (salesChartInstance) salesChartInstance.destroy();

        salesChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Unidades Vendidas',
                    data: data,
                    backgroundColor: 'rgba(211, 47, 47, 0.7)',
                    borderColor: 'rgba(211, 47, 47, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } }
            }
        });
        
        renderAdminOrdersTable(orders);

    } catch (e) {
        toast("Error cargando métricas", "error");
    }
}

function renderAdminOrdersTable(orders) {
    const tbody = document.getElementById("admin-orders-table");
    if (!tbody) return;

    tbody.innerHTML = "";
    const sortedOrders = orders.reverse(); 

    sortedOrders.forEach(o => {
        const statusOptions = ['recibido', 'preparando', 'listo', 'entregado'];
        let optionsHTML = "";
        
        statusOptions.forEach(st => {
            const selected = o.status === st ? "selected" : "";
            optionsHTML += `<option value="${st}" ${selected}>${st.toUpperCase()}</option>`;
        });

        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #eee";
        tr.innerHTML = `
            <td style="padding:15px; font-family:monospace;">...${o.id.slice(-6)}</td>
            <td style="padding:15px;">${o.customer_email}</td>
            <td style="padding:15px; font-size:0.9rem;">
                ${o.items.map(i => `${i.quantity}x ${i.name}`).join('<br>')}
            </td>
            <td style="padding:15px;">$${o.total.toLocaleString('es-CL')}</td>
            <td style="padding:15px;">
                <select 
                    onchange="changeOrderStatus('${o.id}', this.value)"
                    style="padding:5px; border-radius:4px; border:1px solid #ddd; background:#333; color:white; cursor:pointer;"
                >
                    ${optionsHTML}
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const label = input.previousElementSibling;
    const originalText = label.innerText;
    label.innerText = "⏳ Subiendo...";

    try {
        const res = await fetch(`${API}/upload`, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Error subiendo");
        
        const data = await res.json();
        document.getElementById("adm-img-url").value = data.url;
        
        const preview = document.getElementById("preview-img");
        preview.src = data.url.startsWith('http') ? data.url : `${API}${data.url}`;
        preview.style.display = "block";
        
        toast("Imagen subida", "success");
        label.innerText = "✅ Listo";
    } catch (e) {
        toast("Error al subir imagen", "error");
        label.innerText = "❌ Error";
    } finally {
        setTimeout(() => label.innerText = originalText, 2000);
    }
}

async function saveProduct() {
    const id = parseInt(document.getElementById("adm-id").value);
    const name = document.getElementById("adm-name").value;
    const cat = document.getElementById("adm-cat").value;
    const price = parseInt(document.getElementById("adm-price").value);
    const stock = parseInt(document.getElementById("adm-stock").value);
    const img = document.getElementById("adm-img-url").value || "https://via.placeholder.com/150";

    if (!id || !name || !price) return toast("Faltan datos obligatorios", "error");

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
    } catch (e) {
        toast(e.message || "Error al guardar", "error");
    }
}

function clearForm() {
    document.getElementById("adm-id").value = "";
    document.getElementById("adm-name").value = "";
    document.getElementById("adm-price").value = "";
    document.getElementById("adm-stock").value = "";
    
    const urlInput = document.getElementById("adm-img-url");
    if (urlInput) urlInput.value = "";
    const fileInput = document.getElementById("adm-file");
    if (fileInput) fileInput.value = ""; 
    const preview = document.getElementById("preview-img");
    if (preview) {
        preview.src = "";
        preview.style.display = "none";
    }

    isEditingId = null;
    document.getElementById("adm-id").disabled = false;
    const btn = document.querySelector("button[onclick='saveProduct()']");
    if(btn) btn.innerText = "Guardar";
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
    let imgUrl = p.image;
    if(!imgUrl.startsWith('http')) imgUrl = `${API}${imgUrl}`;
    preview.src = imgUrl;
    preview.style.display = "block";

    const btn = document.querySelector("button[onclick='saveProduct()']");
    btn.innerText = "💾 Actualizar";
    
    document.getElementById("admin-panel").scrollIntoView({ behavior: 'smooth' });
}

async function addStock(id) {
    currentEditingProductId = id;
    const p = state.products.find(x => x.id === id);
    if(p) document.getElementById("stock-prod-name").innerText = p.name;
    document.getElementById("new-stock-qty").value = 10;
    openModal("stock-modal");
}

async function confirmStockUpdate() {
    const qty = parseInt(document.getElementById("new-stock-qty").value);
    if (!qty || qty <= 0) return toast("Cantidad inválida", "error");

    try {
        await api(`/admin/stock/${currentEditingProductId}`, "POST", { quantity: qty });
        toast("Stock actualizado", "success");
        closeModal("stock-modal");
        loadAdminTable();
    } catch (e) {
        toast("Error al actualizar", "error");
    }
}

async function changeOrderStatus(id, newStatus) {
    try {
        await api(`/orders/${id}/status`, "PATCH", { status: newStatus });
        toast(`Estado cambiado a: ${newStatus}`, "success");
    } catch (e) {
        toast("Error actualizando estado", "error");
    }
}

async function deleteProduct(id) {
    if (!confirm("¿Eliminar producto?")) return;
    try {
        await api(`/products/${id}`, "DELETE");
        toast("Eliminado", "success");
        loadAdminTable();
    } catch (e) { toast("Error al eliminar", "error"); }
}

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
    } catch (e) { toast(e.message || "Error de login", "error"); }
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
    console.log("Actualizando interfaz de usuario...");
    const authLinks = document.getElementById("auth-links");
    const userInfo = document.getElementById("user-info");
    const bottomProfile = document.querySelectorAll(".nav-item")[3];

    if (state.user) {
        if(authLinks) authLinks.classList.add("hidden");
        if(userInfo) {
            userInfo.classList.remove("hidden");
            userInfo.style.display = "flex";
            document.getElementById("user-name-display").innerText = state.user.name;
        }

        const adminLink = document.getElementById("admin-link");
        if(state.user.role === 'admin' && adminLink) {
            adminLink.classList.remove("hidden");

            createMobileAdminBtn();
        }

        if(bottomProfile) bottomProfile.innerHTML = `<span>👤</span><small>${state.user.name.split(' ')[0]}</small>`;

    } else {
        if(authLinks) authLinks.classList.remove("hidden");
        if(userInfo) userInfo.classList.add("hidden");
        if(bottomProfile) bottomProfile.innerHTML = `<span>👤</span><small>Perfil</small>`;

        const btn = document.getElementById("mobile-admin-btn");
        if(btn) btn.remove();
    }
}

function createMobileAdminBtn() {
    if(document.getElementById("mobile-admin-btn")) return;
    if(window.innerWidth > 768) return;

    const btn = document.createElement("button");
    btn.id = "mobile-admin-btn";
    btn.innerHTML = "⚙️";
    btn.onclick = toggleAdminPanel;
    btn.style.cssText = "position:fixed; bottom:90px; right:20px; width:50px; height:50px; border-radius:50%; background:#2d3748; color:white; font-size:1.5rem; border:none; box-shadow:0 4px 10px rgba(0,0,0,0.3); z-index:4500;";
    document.body.appendChild(btn);
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

function nextFocus(event, nextId) {
    if (event.key === "Enter") {
        const el = document.getElementById(nextId);
        if(el) el.focus();
        if(nextId.includes('btn')) el.click();
    }
}

function saveSession() { localStorage.setItem("dw_sess", JSON.stringify({ u: state.user, t: state.token })); }

function loadSession() { 
    const s = JSON.parse(localStorage.getItem("dw_sess")); 
    if(s) { state.user=s.u; state.token=s.t; updateAuthUI(); } 
}
function saveCart() { localStorage.setItem("dw_cart", JSON.stringify(state.cart)); }

function loadCartFromStorage() { 
    const c = JSON.parse(localStorage.getItem("dw_cart")); 
    if(c) { state.cart=c; } 
}

async function loadAdminTable() {
    const tbody = document.getElementById("adm-table");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';

    try {

        if (state.products.length === 0) {
            state.products = await api("/products");
        }

        tbody.innerHTML = "";
        state.products.forEach(p => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${p.id}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${p.image.startsWith('http') ? p.image : API + p.image}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">
                        ${p.name}
                    </div>
                </td>
                <td>$${p.price.toLocaleString('es-CL')}</td>
                <td>${p.stock}</td>
                <td>
                    <button onclick="editProduct(${p.id})" style="cursor:pointer; margin-right:5px;">✏️</button>
                    <button onclick="deleteProduct(${p.id})" style="cursor:pointer; color:red;">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Error cargando datos</td></tr>';
    }
}

loadCartFromStorage();
