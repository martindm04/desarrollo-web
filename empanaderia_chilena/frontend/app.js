// --- 1. VARIABLES GLOBALES ---
const grid = document.getElementById('product-grid');
const cartSidebar = document.getElementById('cart-sidebar');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total-price');
const cartCountElement = document.getElementById('cart-count');

let productsDB = [];
let cart = [];
let currentUser = null;
let selectedProductForModal = null;
let tempQty = 1;

// --- 2. INICIO Y EVENTOS ---
async function init() {
    await fetchProducts();
    loadCartFromStorage();
    loadSessionFromStorage();
    setupGlobalEvents(); // Punto 1: ESC
    loadDynamicCarousel(); // Punto 2: Carrusel dinámico
}

function setupGlobalEvents() {
    // Cerrar modales con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
            if(cartSidebar.classList.contains('active')) toggleCart();
        }
    });
}

// Punto 2: Carrusel Dinámico (Muestra 3 productos al azar)
// --- CARRUSEL HERO INTELIGENTE ---
let carouselInterval;

function loadDynamicCarousel() {
    const track = document.getElementById('carousel-track');
    const dotsContainer = document.getElementById('carousel-dots');
    
    // 1. Filtrar productos que tengan FOTO REAL (URL http) y Stock
    const candidates = productsDB.filter(p => p.image && p.image.startsWith('http') && p.stock > 0);
    
    if (candidates.length === 0) {
        document.getElementById('main-carousel').style.display = 'none';
        return;
    }

    // Tomar máximo 3 destacados
    const featured = candidates.slice(0, 3);
    
    track.innerHTML = '';
    dotsContainer.innerHTML = '';

    featured.forEach((p, index) => {
        // Crear Slide
        const item = document.createElement('div');
        item.className = 'carousel-item';
        // Fondo sutil basado en categoría
        const bgColor = p.category === 'horno' ? '#FFF3E0' : (p.category === 'frita' ? '#FFFDE7' : '#E3F2FD');
        item.style.backgroundColor = bgColor;

        item.innerHTML = `
            <div class="carousel-text">
                <span class="badge ${p.category}" style="position:static; display:inline-block; margin-bottom:10px;">${p.category}</span>
                <h2>${p.name}</h2>
                <p>Deliciosa preparación artesanal.</p>
                <span class="price-tag">$${p.price.toLocaleString('es-CL')}</span>
                <button class="btn-primary" style="width:auto; padding: 12px 30px; font-size:1.1rem;" onclick="openAddToCartModal(${p.id})">
                    ¡Lo Quiero! 🛒
                </button>
            </div>
            <div class="carousel-image">
                <img src="${p.image}" alt="${p.name}">
            </div>
        `;
        track.appendChild(item);

        // Crear Punto
        const dot = document.createElement('div');
        dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
        dot.onclick = () => goToSlide(index);
        dotsContainer.appendChild(dot);
    });

    startCarouselAutoPlay(featured.length);
}

function goToSlide(index) {
    const track = document.getElementById('carousel-track');
    track.style.transform = `translateX(-${index * 100}%)`;
    
    // Actualizar puntos
    document.querySelectorAll('.carousel-dot').forEach((d, i) => {
        d.className = `carousel-dot ${i === index ? 'active' : ''}`;
    });
}

function startCarouselAutoPlay(count) {
    let current = 0;
    if (carouselInterval) clearInterval(carouselInterval);
    
    carouselInterval = setInterval(() => {
        current = (current + 1) % count;
        goToSlide(current);
    }, 5000); // Cambia cada 5 segundos
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

function saveCartToStorage() { localStorage.setItem('empanada_cart', JSON.stringify(cart)); }
function loadCartFromStorage() {
    const saved = localStorage.getItem('empanada_cart');
    if (saved) { cart = JSON.parse(saved); updateCartUI(); }
}
function saveSessionToStorage() { localStorage.setItem('empanada_user', JSON.stringify(currentUser)); }
function loadSessionFromStorage() {
    const saved = localStorage.getItem('empanada_user');
    if (saved) { currentUser = JSON.parse(saved); updateUserUI(); }
}

// --- 4. CATÁLOGO Y FILTROS (Punto 5 Arreglado) ---
async function fetchProducts() {
    try {
        const res = await fetch('http://127.0.0.1:8000/products');
        productsDB = await res.json();
        renderProducts(productsDB);
    } catch (e) { console.error(e); }
}

function renderProducts(products) {
    grid.innerHTML = '';
    products.forEach(p => {
        const isStock = p.stock > 0;
        let imgContent = p.image.startsWith('http') 
            ? `<img src="${p.image}" alt="${p.name}">` 
            : `<span style="font-size:3rem;">🥟</span>`;
        
        const card = document.createElement('div');
        // Punto 6: Clase out-of-stock si stock es 0
        card.className = `card ${!isStock ? 'out-of-stock' : ''}`;
        
        card.onclick = (e) => {
            // Evitar abrir si se hace clic en botones internos (si hubieran)
            if (isStock) openAddToCartModal(p.id);
            else showToast("Producto agotado", "error");
        };

        card.innerHTML = `
            <span class="badge ${p.category}">${p.category}</span>
            <div class="card-img-container">${imgContent}</div>
            <div class="card-body">
                <h3 class="card-title">${p.name}</h3>
                <div class="card-footer">
                    <span class="card-price">$${p.price.toLocaleString('es-CL')}</span>
                    <small style="color:${isStock ? 'green' : 'red'}">${isStock ? 'Stock: '+p.stock : 'Agotado'}</small>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Punto 5: Filtro arreglado
function filterProducts() {
    const searchText = document.getElementById('search-bar').value.toLowerCase();
    const selectedCategory = document.getElementById('category-filter').value;

    const filtered = productsDB.filter(product => {
        const matchesText = product.name.toLowerCase().includes(searchText);
        const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
        return matchesText && matchesCategory;
    });

    renderProducts(filtered);
}

// Listeners para filtros
document.getElementById('search-bar').addEventListener('keyup', filterProducts);
document.getElementById('category-filter').addEventListener('change', filterProducts);


// --- 5. MODAL DE CANTIDAD ---
function openAddToCartModal(id) {
    selectedProductForModal = productsDB.find(p => p.id === id);
    tempQty = 1;
    document.getElementById('modal-product-name').innerText = selectedProductForModal.name;
    document.getElementById('modal-qty').innerText = tempQty;
    openModal('add-to-cart-modal');
}

function adjustModalQty(delta) {
    const newQty = tempQty + delta;
    if (newQty >= 1 && newQty <= selectedProductForModal.stock) {
        tempQty = newQty;
        document.getElementById('modal-qty').innerText = tempQty;
    }
}

function confirmAddFromModal(action) {
    addToCart(selectedProductForModal.id, tempQty);
    closeModal('add-to-cart-modal');
    if (action === 'checkout') toggleCart();
}

// --- 6. CARRITO ---
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
            <div><strong>${item.name}</strong><br>$${item.price} x ${item.quantity}</div>
            <div>
                <button onclick="updateItemQty(${item.id}, -1)" style="padding:2px 8px;">-</button>
                <button onclick="updateItemQty(${item.id}, 1)" style="padding:2px 8px;">+</button>
            </div>
        `;
        cartItemsContainer.innerHTML += div.outerHTML;
    });
    const net = Math.round(total / 1.19);
    document.getElementById('cart-subtotal').innerText = `$${net.toLocaleString('es-CL')}`;
    document.getElementById('cart-tax').innerText = `$${(total - net).toLocaleString('es-CL')}`;
    cartTotalElement.innerText = `$${total.toLocaleString('es-CL')}`;
    cartCountElement.innerText = count;
}

function updateItemQty(id, delta) {
    const item = cart.find(i => i.id === id);
    const info = productsDB.find(p => p.id === id); // Info fresca para validar stock
    
    // Si estamos sumando, chequear stock
    if (delta > 0 && item.quantity >= info.stock) {
        return showToast("Stock máximo alcanzado", "info");
    }

    item.quantity += delta;
    if (item.quantity <= 0) cart = cart.filter(i => i.id !== id);
    
    saveCartToStorage();
    updateCartUI();
}

// --- 7. CHECKOUT Y PAGO (Punto 4: Descontar Stock) ---
function openCheckoutModal() {
    if (cart.length === 0) return showToast("Carrito vacío", "error");
    if (!currentUser) {
        showToast("Inicia sesión para comprar", "info");
        return openModal('login-modal');
    }
    // Mostrar total
    const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    document.getElementById('modal-total-amount').innerText = `$${total.toLocaleString('es-CL')}`;
    document.getElementById('modal-user-email').innerText = currentUser.email;
    
    toggleCart(); // Cerrar sidebar para que no tape el modal (Punto 6)
    openModal('checkout-modal');
}

async function confirmCheckout() {
    const orderData = {
        customer_email: currentUser.email,
        items: cart.map(i => ({ product_id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        total: cart.reduce((sum, i) => sum + (i.price * i.quantity), 0)
    };

    try {
        const res = await fetch('http://127.0.0.1:8000/orders', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(orderData)
        });
        
        if(!res.ok) {
            // Manejar error de stock (Backend responde 400)
            const err = await res.json();
            throw new Error(err.detail || "Error al procesar");
        }

        const result = await res.json();
        closeModal('checkout-modal');
        showToast(`¡Orden exitosa! ID: #${result.id.slice(-4)}`, "success");
        
        cart = []; 
        saveCartToStorage(); 
        updateCartUI();
        fetchProducts(); // Recargar productos para ver nuevo stock (Punto 4)

    } catch (e) { 
        showToast(e.message, "error"); 
        closeModal('checkout-modal'); // Cerrar modal si falla para revisar
    }
}

// --- 8. USUARIOS ---
async function loginUser() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
        const res = await fetch('http://127.0.0.1:8000/login', {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email, password: pass, name:'temp'})
        });
        if(!res.ok) throw new Error("Datos incorrectos");
        currentUser = await res.json();
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
    if(currentUser.email.includes('@admin.com')) {
        document.getElementById('admin-link').classList.remove('hidden');
        document.getElementById('admin-link').style.display = 'inline';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('empanada_user');
    location.reload();
}

// --- 9. HISTORIAL DE PEDIDOS ---
async function openOrderHistory() {
    openModal('history-modal');
    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
    const res = await fetch(`http://127.0.0.1:8000/orders/user/${currentUser.email}`);
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
}

// --- 10. PANEL DE ADMINISTRACIÓN (MEJORADO) ---
function toggleAdminPanel() {
    const panel = document.getElementById('admin-panel');
    const mainGrid = document.getElementById('product-grid');
    const carousel = document.getElementById('main-carousel');
    const controls = document.querySelector('.controls');

    if (panel.classList.contains('hidden')) {
        // Mostrar Admin
        panel.classList.remove('hidden');
        mainGrid.classList.add('hidden');
        carousel.classList.add('hidden');
        controls.classList.add('hidden');
        loadAdminTable();
    } else {
        // Mostrar Tienda
        panel.classList.add('hidden');
        mainGrid.classList.remove('hidden');
        carousel.classList.remove('hidden');
        controls.classList.remove('hidden');
        fetchProducts();
    }
}

// Cambio de Pestañas Admin (Punto 3)
function switchAdminTab(tabName) {
    // Ocultar todos los contenidos y desactivar botones
    document.querySelectorAll('.admin-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    // Activar seleccionado
    document.getElementById(`tab-${tabName}`).classList.add('active');
    // Buscar el botón correspondiente (truco simple: por orden o texto, aquí asumimos por orden de clic)
    event.target.classList.add('active');

    if (tabName === 'orders') loadAdminOrders();
    if (tabName === 'products') loadAdminTable();
}

// Cargar Productos (Tabla 1)
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

// Cargar Ventas (Tabla 2 - Punto 3)
// Variable global para el gráfico (para poder destruirlo y redibujarlo)
let myChart = null;

async function loadAdminOrders() {
    const tbody = document.getElementById('admin-orders-body');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Cargando datos...</td></tr>';
    
    try {
        const res = await fetch('http://127.0.0.1:8000/orders');
        const orders = await res.json();
        
        tbody.innerHTML = '';
        
        // 1. Variables para estadística
        const salesStats = {}; // { "Empanada Pino": 10, "Bebida": 5 }

        // 2. Procesar órdenes
        orders.forEach(o => {
            // Llenar tabla
            const summary = o.items.map(i => {
                // Sumar para estadística
                if (salesStats[i.name]) {
                    salesStats[i.name] += i.quantity;
                } else {
                    salesStats[i.name] = i.quantity;
                }
                return `${i.quantity}x ${i.name}`;
            }).join(', ');

            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #eee";
            tr.innerHTML = `
                <td style="padding:12px; font-family:monospace;">#${o.id.slice(-6)}</td>
                <td style="padding:12px;">${o.customer_email}</td>
                <td style="padding:12px;">$${o.total.toLocaleString('es-CL')}</td>
                <td style="padding:12px; font-size:0.9em; color:#555;">${summary}</td>
            `;
            tbody.appendChild(tr);
        });

        // 3. Dibujar Gráfico
        renderChart(salesStats);

    } catch (e) { 
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" style="color:red; text-align:center;">Error al cargar ventas</td></tr>'; 
    }
}

// Función para dibujar con Chart.js
function renderChart(stats) {
    const ctx = document.getElementById('salesChart');
    
    // Si ya existe un gráfico previo, lo destruimos para no sobreponer
    if (myChart) {
        myChart.destroy();
    }

    // Preparar datos para Chart.js
    const labels = Object.keys(stats);
    const data = Object.values(stats);

    myChart = new Chart(ctx, {
        type: 'bar', // Puede ser 'pie', 'doughnut', 'line'
        data: {
            labels: labels,
            datasets: [{
                label: 'Unidades Vendidas',
                data: data,
                backgroundColor: [
                    'rgba(218, 41, 28, 0.7)',  // Rojo Chile
                    'rgba(0, 57, 166, 0.7)',   // Azul Chile
                    'rgba(241, 196, 15, 0.7)', // Amarillo
                    'rgba(46, 204, 113, 0.7)', // Verde
                    'rgba(155, 89, 182, 0.7)'  // Morado
                ],
                borderColor: [
                    'rgba(218, 41, 28, 1)',
                    'rgba(0, 57, 166, 1)',
                    'rgba(241, 196, 15, 1)',
                    'rgba(46, 204, 113, 1)',
                    'rgba(155, 89, 182, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 } // Para no mostrar decimales en ventas
                }
            },
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Total de Productos Vendidos (Histórico)'
                }
            }
        }
    });
}

// Funciones CRUD (Igual que antes)
async function saveProduct() {
    const id = parseInt(document.getElementById('adm-id').value);
    const name = document.getElementById('adm-name').value;
    const category = document.getElementById('adm-category').value;
    const price = parseInt(document.getElementById('adm-price').value);
    const stock = parseInt(document.getElementById('adm-stock').value);
    const image = document.getElementById('adm-image').value;

    if (!id || !name) return showToast("Faltan datos", "error");
    const productData = { id, name, category, price, stock, image };
    const exists = productsDB.some(p => p.id === id);
    const method = exists ? 'PUT' : 'POST';
    const url = exists ? `http://127.0.0.1:8000/products/${id}` : 'http://127.0.0.1:8000/products';

    try {
        const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(productData)});
        if(!res.ok) throw new Error("Error guardando");
        showToast("Guardado exitoso", "success");
        const r = await fetch('http://127.0.0.1:8000/products');
        productsDB = await r.json();
        loadAdminTable();
        clearAdminForm();
    } catch(e) { showToast(e.message, "error"); }
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

async function deleteProduct(id) {
    if(!confirm("¿Eliminar?")) return;
    await fetch(`http://127.0.0.1:8000/products/${id}`, {method:'DELETE'});
    showToast("Eliminado", "info");
    const r = await fetch('http://127.0.0.1:8000/products');
    productsDB = await r.json();
    loadAdminTable();
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