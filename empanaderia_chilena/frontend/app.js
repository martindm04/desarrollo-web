// --- 1. VARIABLES GLOBALES ---
const grid = document.getElementById('product-grid');
const cartSidebar = document.getElementById('cart-sidebar');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total-price');
const cartCountElement = document.getElementById('cart-count');

let productsDB = [];
let cart = [];
let currentUser = null;
let currentToken = null; // Almacena el JWT
let selectedProductForModal = null;
let tempQty = 1;

// Variables Carrusel
let currentSlide = 0;
let totalSlides = 0;
let carouselInterval;
let featuredProducts = [];

// --- 2. INICIO Y EVENTOS ---
async function init() {
    loadSessionFromStorage(); // Carga usuario Y TOKEN
    await fetchProducts();
    loadCartFromStorage();
    setupGlobalEvents();
    loadDynamicCarousel();
}

function setupGlobalEvents() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
            if(cartSidebar.classList.contains('active')) toggleCart();
        }
    });
}

// --- GESTIÓN DE SESIÓN Y TOKENS ---
function saveSessionToStorage() {
    if (currentUser && currentToken) {
        localStorage.setItem('empanada_user', JSON.stringify(currentUser));
        localStorage.setItem('empanada_token', currentToken);
    }
}

function loadSessionFromStorage() {
    const savedUser = localStorage.getItem('empanada_user');
    const savedToken = localStorage.getItem('empanada_token');
    
    if (savedUser && savedToken) {
        currentUser = JSON.parse(savedUser);
        currentToken = savedToken;
        updateUserUI();
    }
}

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}` // Header Clave para Backend
    };
}

function saveCartToStorage() { localStorage.setItem('empanada_cart', JSON.stringify(cart)); }
function loadCartFromStorage() {
    const saved = localStorage.getItem('empanada_cart');
    if (saved) { cart = JSON.parse(saved); updateCartUI(); }
}

// --- 3. UTILIDADES ---
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function handleEnter(event, nextId) {
    if (event.key === 'Enter') {
        if (nextId === 'login-btn') loginUser();
        else document.getElementById(nextId).focus();
    }
}

// --- 4. CATÁLOGO ---
async function fetchProducts() {
    try {
        const res = await fetch('http://127.0.0.1:8000/products');
        productsDB = await res.json();
        renderProducts(productsDB);
        loadDynamicCarousel();
    } catch (e) { console.error(e); }
}

function renderProducts(products) {
    grid.innerHTML = '';
    products.forEach(p => {
        const isStock = p.stock > 0;
        let imgContent = p.image.startsWith('http') ? `<img src="${p.image}" alt="${p.name}">` : `<span style="font-size:3rem;">🥟</span>`;
        
        const card = document.createElement('div');
        card.className = `card ${!isStock ? 'out-of-stock' : ''}`;
        card.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON' && isStock) openAddToCartModal(p.id);
        };

        card.innerHTML = `
            <span class="badge ${p.category}">${p.category}</span>
            <div class="card-img-container">${imgContent}</div>
            <div class="card-body">
                <div class="card-title">${p.name}</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span style="font-weight:bold; color:var(--primary);">$${p.price.toLocaleString('es-CL')}</span>
                    <small style="color:${isStock ? 'green' : 'red'}">${isStock ? 'Stock: '+p.stock : 'Agotado'}</small>
                </div>
                <button class="btn-add-card" ${!isStock ? 'disabled':''} onclick="openAddToCartModal(${p.id})">
                    ${isStock ? 'Agregar' : 'Sin Stock'}
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterProducts() {
    const txt = document.getElementById('search-bar').value.toLowerCase();
    const cat = document.getElementById('category-filter').value;
    const filtered = productsDB.filter(p => {
        return p.name.toLowerCase().includes(txt) && (cat === 'all' || p.category === cat);
    });
    renderProducts(filtered);
}
document.getElementById('search-bar').addEventListener('keyup', filterProducts);
document.getElementById('category-filter').addEventListener('change', filterProducts);

// --- CARRUSEL ---
function loadDynamicCarousel() {
    const track = document.getElementById('carousel-track');
    const dotsContainer = document.getElementById('carousel-dots');
    if(!track) return;

    featuredProducts = productsDB.filter(p => p.image && p.image.startsWith('http') && p.stock > 0).slice(0, 5);
    totalSlides = featuredProducts.length;
    currentSlide = 0;
    
    if(featuredProducts.length === 0) {
        document.getElementById('main-carousel').style.display = 'none';
        return;
    } else {
        document.getElementById('main-carousel').style.display = 'block';
    }

    track.innerHTML = '';
    dotsContainer.innerHTML = '';

    featuredProducts.forEach((p, index) => {
        const item = document.createElement('div');
        item.className = 'carousel-item';
        const bgColor = p.category === 'horno' ? '#FFF3E0' : (p.category === 'frita' ? '#FFFDE7' : '#E3F2FD');
        item.style.backgroundColor = bgColor;

        item.innerHTML = `
            <div class="carousel-text">
                <span class="badge ${p.category}" style="position:relative; top:0; right:0; margin-bottom:10px; display:inline-block;">${p.category}</span>
                <h2>${p.name}</h2>
                <p>Deliciosa preparación artesanal.</p>
                <span class="price">$${p.price.toLocaleString('es-CL')}</span>
                <button class="btn-add-card" style="width:auto; border-radius:20px; padding:10px 30px; background:var(--secondary);" onclick="openAddToCartModal(${p.id})">
                    ¡Lo Quiero! 🛒
                </button>
            </div>
            <div class="carousel-image">
                <img src="${p.image}" alt="${p.name}">
            </div>
        `;
        track.appendChild(item);

        const dot = document.createElement('div');
        dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
        dot.onclick = () => goToSlide(index);
        dotsContainer.appendChild(dot);
    });
    startCarouselAutoPlay();
}

function nextSlide() { if(totalSlides) { currentSlide = (currentSlide + 1) % totalSlides; updateCarousel(); resetTimer(); } }
function prevSlide() { if(totalSlides) { currentSlide = (currentSlide - 1 + totalSlides) % totalSlides; updateCarousel(); resetTimer(); } }
function goToSlide(index) { currentSlide = index; updateCarousel(); resetTimer(); }
function updateCarousel() {
    const track = document.getElementById('carousel-track');
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    document.querySelectorAll('.carousel-dot').forEach((d, i) => {
        if (i === currentSlide) d.classList.add('active'); else d.classList.remove('active');
    });
}
function startCarouselAutoPlay() {
    if (carouselInterval) clearInterval(carouselInterval);
    carouselInterval = setInterval(nextSlide, 5000);
}
function resetTimer() { clearInterval(carouselInterval); startCarouselAutoPlay(); }

// --- 5. MODALES Y CARRITO ---
function openAddToCartModal(id) {
    selectedProductForModal = productsDB.find(p => p.id === id);
    tempQty = 1;
    document.getElementById('modal-product-name').innerText = selectedProductForModal.name;
    document.getElementById('modal-qty').innerText = tempQty;
    openModal('add-to-cart-modal');
}
function adjustModalQty(d) {
    const n = tempQty + d;
    if(n >= 1 && n <= selectedProductForModal.stock) {
        tempQty = n;
        document.getElementById('modal-qty').innerText = tempQty;
    }
}
function confirmAddFromModal(action) {
    addToCart(selectedProductForModal.id, tempQty);
    closeModal('add-to-cart-modal');
    if (action === 'checkout') toggleCart();
}
function toggleCart() {
    cartSidebar.classList.toggle('active');
    document.getElementById('cart-overlay').classList.toggle('active');
}
function addToCart(id, qty = 1) {
    const existing = cart.find(i => i.id === id);
    const info = productsDB.find(p => p.id === id);
    if (existing) {
        if (existing.quantity + qty <= info.stock) existing.quantity += qty;
        else return showToast("Stock insuficiente", "error");
    } else {
        cart.push({ ...info, quantity: qty });
    }
    saveCartToStorage();
    updateCartUI();
    showToast("Agregado al carrito", "success");
}
function updateCartUI() {
    cartItemsContainer.innerHTML = '';
    let total = 0; let count = 0;
    cart.forEach(item => {
        total += item.price * item.quantity;
        count += item.quantity;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <h4 style="margin:0; font-size:1rem;">${item.name}</h4>
                <p style="margin:5px 0 0; color:#666;">$${item.price.toLocaleString('es-CL')} x ${item.quantity}</p>
            </div>
            <div class="cart-controls" style="display:flex; align-items:center; gap:10px;">
                <button class="qty-btn qty-sm" onclick="updateItemQty(${item.id}, -1)">-</button>
                <span style="font-weight:bold; min-width:20px; text-align:center;">${item.quantity}</span>
                <button class="qty-btn qty-sm" onclick="updateItemQty(${item.id}, 1)">+</button>
            </div>
        `;
        cartItemsContainer.innerHTML += div.outerHTML;
    });
    const net = Math.round(total / 1.19);
    document.getElementById('cart-subtotal').innerText = `$${net.toLocaleString('es-CL')}`;
    document.getElementById('cart-tax').innerText = `$${(total - net).toLocaleString('es-CL')}`;
    cartTotalElement.innerText = `$${total.toLocaleString('es-CL')}`;
    cartCountElement.innerText = count;
    if (cart.length === 0) cartItemsContainer.innerHTML = '<p style="text-align:center; color:#888; margin-top:20px;">Tu carrito está vacío 🥟</p>';
}
function updateItemQty(id, delta) {
    const item = cart.find(i => i.id === id);
    const info = productsDB.find(p => p.id === id);
    if (delta > 0 && item.quantity >= info.stock) return showToast("Stock máximo alcanzado", "info");
    item.quantity += delta;
    if (item.quantity <= 0) cart = cart.filter(i => i.id !== id);
    saveCartToStorage();
    updateCartUI();
}

// --- 7. AUTHENTICATION (Login con Token) ---
async function registerUser() {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;
    if (!name || !email || !password) return showToast("Faltan datos", "error");
    try {
        const res = await fetch('http://127.0.0.1:8000/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail);
        }
        showToast("¡Cuenta creada! Inicia sesión.", "success");
        closeModal('register-modal');
        openModal('login-modal');
    } catch (e) { showToast(e.message, "error"); }
}

async function loginUser() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
        const res = await fetch('http://127.0.0.1:8000/login', {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email, password: pass, name:'temp'})
        });
        if(!res.ok) throw new Error("Credenciales incorrectas");
        const data = await res.json();
        
        // GUARDAR TOKEN
        currentUser = data.user;
        currentToken = data.access_token;
        saveSessionToStorage();
        
        updateUserUI();
        closeModal('login-modal');
        showToast(`Hola ${currentUser.name}`, "success");
    } catch (e) { showToast(e.message, "error"); }
}

function updateUserUI() {
    document.getElementById('auth-links').style.display = 'none';
    const infoDiv = document.getElementById('user-info');
    infoDiv.classList.remove('hidden'); 
    infoDiv.style.display = 'flex';
    document.getElementById('user-name-display').innerText = currentUser.name;
    if(currentUser.role === 'admin') {
        document.getElementById('admin-link').classList.remove('hidden');
        document.getElementById('admin-link').style.display = 'inline';
    }
}

function logout() {
    currentUser = null;
    currentToken = null;
    localStorage.removeItem('empanada_user');
    localStorage.removeItem('empanada_token');
    location.reload();
}

// --- 8. FUNCIONES PROTEGIDAS (Usan Token) ---
function openCheckoutModal() {
    if (cart.length === 0) return showToast("Carrito vacío", "error");
    if (!currentUser) { showToast("Inicia sesión para comprar", "info"); return openModal('login-modal'); }
    const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    document.getElementById('modal-total-amount').innerText = `$${total.toLocaleString('es-CL')}`;
    document.getElementById('modal-user-email').innerText = currentUser.email;
    toggleCart(); openModal('checkout-modal');
}

async function confirmCheckout() {
    const orderData = {
        customer_email: currentUser.email,
        items: cart.map(i => ({ product_id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        total: cart.reduce((sum, i) => sum + (i.price * i.quantity), 0)
    };
    try {
        const res = await fetch('http://127.0.0.1:8000/orders', {
            method: 'POST', 
            headers: getAuthHeaders(), // TOKEN
            body: JSON.stringify(orderData)
        });
        if(!res.ok) throw new Error("Error al procesar");
        const result = await res.json();
        closeModal('checkout-modal');
        showToast(`¡Orden exitosa!`, "success");
        cart = []; saveCartToStorage(); updateCartUI(); fetchProducts();
    } catch (e) { showToast("Error en el pago", "error"); }
}

async function openOrderHistory() {
    openModal('history-modal');
    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
    try {
        const res = await fetch(`http://127.0.0.1:8000/orders/user/${currentUser.email}`, {
            headers: getAuthHeaders() // TOKEN
        });
        if (!res.ok) throw new Error();
        const orders = await res.json();
        tbody.innerHTML = '';
        if(orders.length === 0) document.getElementById('no-history-msg').classList.remove('hidden');
        else {
            document.getElementById('no-history-msg').classList.add('hidden');
            orders.reverse().forEach(o => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>#${o.id.slice(-4)}</td><td>$${o.total.toLocaleString('es-CL')}</td><td>${o.status}</td><td>${o.items.length} items</td>`;
                tbody.appendChild(tr);
            });
        }
    } catch (e) { tbody.innerHTML = '<tr><td colspan="4">Error</td></tr>'; }
}

// --- ADMIN (Protegido) ---
function toggleAdminPanel() {
    const panel = document.getElementById('admin-panel');
    const elToHide = [grid, document.getElementById('main-carousel'), document.querySelector('.controls'), document.getElementById('no-results')];
    if(panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        elToHide.forEach(e => e?.classList.add('hidden'));
        loadAdminTable();
    } else {
        panel.classList.add('hidden');
        elToHide.forEach(e => e?.classList.remove('hidden'));
        fetchProducts();
    }
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    if(event) event.currentTarget.classList.add('active');
    if(tab === 'orders') { loadAdminOrders(); if(myChart) setTimeout(() => myChart.resize(), 100); }
    else loadAdminTable();
}

function loadAdminTable() {
    const tbody = document.getElementById('admin-table-body');
    tbody.innerHTML = '';
    productsDB.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:12px;">${p.id}</td>
            <td>${p.name}</td>
            <td>$${p.price}</td>
            <td>${p.stock}</td>
            <td>
                <button onclick="editProduct(${p.id})" style="background:#f1c40f; border:none; padding:5px;">✏️</button>
                <button onclick="deleteProduct(${p.id})" style="background:#e74c3c; color:white; border:none; padding:5px;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

let myChart = null;
async function loadAdminOrders() {
    const tbody = document.getElementById('admin-orders-body');
    tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
    try {
        const res = await fetch('http://127.0.0.1:8000/orders', { headers: getAuthHeaders() });
        const orders = await res.json();
        tbody.innerHTML = '';
        const salesStats = {};
        orders.forEach(o => {
            const summary = o.items.map(i => {
                if (salesStats[i.name]) salesStats[i.name] += i.quantity; else salesStats[i.name] = i.quantity;
                return `${i.quantity}x ${i.name}`;
            }).join(', ');
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>#${o.id.slice(-6)}</td><td>${o.customer_email}</td><td>$${o.total.toLocaleString('es-CL')}</td><td style="font-size:0.8em">${summary}</td>`;
            tbody.appendChild(tr);
        });
        renderChart(salesStats);
    } catch (e) { tbody.innerHTML = '<tr><td colspan="4">Error</td></tr>'; }
}

function renderChart(stats) {
    const ctx = document.getElementById('salesChart');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(stats),
            datasets: [{ label: 'Ventas', data: Object.values(stats), backgroundColor: ['#D32F2F', '#1565C0', '#FBC02D'], borderWidth: 1 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

async function saveProduct() {
    const id = parseInt(document.getElementById('adm-id').value);
    // ... inputs ...
    const productData = { 
        id, 
        name: document.getElementById('adm-name').value,
        category: document.getElementById('adm-category').value,
        price: parseInt(document.getElementById('adm-price').value),
        stock: parseInt(document.getElementById('adm-stock').value),
        image: document.getElementById('adm-image').value 
    };
    const exists = productsDB.some(p => p.id === id);
    try {
        const res = await fetch(exists ? `http://127.0.0.1:8000/products/${id}` : 'http://127.0.0.1:8000/products', {
            method: exists ? 'PUT' : 'POST',
            headers: getAuthHeaders(), // TOKEN
            body: JSON.stringify(productData)
        });
        if(!res.ok) throw new Error();
        showToast("Guardado", "success");
        fetchProducts(); loadAdminTable(); clearAdminForm();
    } catch(e) { showToast("Error", "error"); }
}

async function deleteProduct(id) {
    if(!confirm("¿Eliminar?")) return;
    try {
        const res = await fetch(`http://127.0.0.1:8000/products/${id}`, {
            method:'DELETE',
            headers: getAuthHeaders() // TOKEN
        });
        if (!res.ok) throw new Error();
        showToast("Eliminado", "info");
        fetchProducts(); loadAdminTable();
    } catch (e) { showToast("Error", "error"); }
}
function editProduct(id) {
    const p = productsDB.find(p => p.id === id);
    document.getElementById('adm-id').value = p.id;
    document.getElementById('adm-name').value = p.name;
    document.getElementById('adm-category').value = p.category;
    document.getElementById('adm-price').value = p.price;
    document.getElementById('adm-stock').value = p.stock;
    document.getElementById('adm-image').value = p.image;
}
function clearAdminForm() {
    document.getElementById('adm-id').value = '';
    document.getElementById('adm-name').value = '';
    document.getElementById('adm-price').value = '';
    document.getElementById('adm-stock').value = '';
    document.getElementById('adm-image').value = '';
}

// INICIAR
init();