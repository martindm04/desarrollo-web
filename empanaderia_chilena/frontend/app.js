// --- ESTADO ---
const API_URL = "http://127.0.0.1:8000";
let state = { products: [], cart: [], user: null, token: null, modalItem: null, modalQty: 1 };

// --- INICIO ---
document.addEventListener('DOMContentLoaded', () => {
    loadSession();
    fetchProducts();
    initListeners();
});

function initListeners() {
    document.addEventListener('keydown', e => { if(e.key === 'Escape') closeAllModals(); });
    document.getElementById('search-input').addEventListener('keyup', renderGrid);
    document.getElementById('category-filter').addEventListener('change', renderGrid);
}

// --- API & DATOS ---
async function fetchProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        state.products = await res.json();
        renderGrid();
        renderCarousel();
    } catch(e) { toast("Error conectando al servidor", "error"); }
}

// --- RENDERIZADO ---
function renderGrid() {
    const grid = document.getElementById('grid');
    const term = document.getElementById('search-input').value.toLowerCase();
    const cat = document.getElementById('category-filter').value;
    
    grid.innerHTML = '';
    const filtered = state.products.filter(p => 
        p.name.toLowerCase().includes(term) && (cat === 'all' || p.category === cat)
    );

    if(filtered.length === 0) document.getElementById('empty-state').classList.remove('hidden');
    else document.getElementById('empty-state').classList.add('hidden');

    filtered.forEach(p => {
        const card = document.createElement('div');
        const isStock = p.stock > 0;
        card.className = `card ${!isStock ? 'out' : ''}`;
        card.onclick = (e) => { if(e.target.tagName !== 'BUTTON') openQtyModal(p); };
        
        const img = p.image.startsWith('http') ? `<img src="${p.image}">` : `<span style="font-size:3rem;">🥟</span>`;
        
        card.innerHTML = `
            <span class="badge ${p.category}">${p.category}</span>
            <div class="card-img">${img}</div>
            <div class="card-info">
                <div class="card-title">${p.name}</div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-weight:bold; color:var(--chile-blue);">$${p.price.toLocaleString('es-CL')}</span>
                    <small style="color:${isStock?'green':'red'}">${isStock ? 'Stock: '+p.stock : 'Agotado'}</small>
                </div>
                <button class="btn-add" ${!isStock?'disabled':''} onclick="openQtyModal(${p.id})">
                    ${isStock ? 'Agregar' : 'Sin Stock'}
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- CARRUSEL ---
let slideIdx = 0;
let slideTimer;
function renderCarousel() {
    const track = document.getElementById('carousel-track');
    const featured = state.products.filter(p => p.image.startsWith('http') && p.stock > 0).slice(0, 5);
    if(featured.length === 0) return document.getElementById('hero-carousel').style.display = 'none';

    track.innerHTML = '';
    featured.forEach(p => {
        const d = document.createElement('div');
        d.className = 'carousel-slide';
        d.style.backgroundColor = p.category === 'horno' ? '#FFF5F5' : '#F0F9FF';
        d.innerHTML = `
            <div class="carousel-content">
                <h2>${p.name}</h2>
                <p>Sabor auténtico. ¡Pídela ahora!</p>
                <button class="btn-primary" style="width:auto; padding:10px 30px;" onclick="openQtyModal(${p.id})">Comprar $${p.price}</button>
            </div>
            <img src="${p.image}" class="carousel-img">
        `;
        track.appendChild(d);
    });
    startCarousel();
}
function moveSlide(d) { 
    const count = document.querySelectorAll('.carousel-slide').length;
    slideIdx = (slideIdx + d + count) % count;
    document.getElementById('carousel-track').style.transform = `translateX(-${slideIdx * 100}%)`;
    clearInterval(slideTimer); startCarousel();
}
function startCarousel() { slideTimer = setInterval(() => moveSlide(1), 5000); }

// --- CARRITO ---
function openQtyModal(itemOrId) {
    const p = typeof itemOrId === 'object' ? itemOrId : state.products.find(x => x.id === itemOrId);
    state.modalItem = p; state.modalQty = 1;
    document.getElementById('qty-name').innerText = p.name;
    document.getElementById('qty-val').innerText = 1;
    openModal('qty-modal');
}
function modQty(d) {
    const n = state.modalQty + d;
    if(n >= 1 && n <= state.modalItem.stock) { state.modalQty = n; document.getElementById('qty-val').innerText = n; }
}
function confirmAdd(checkout) {
    const existing = state.cart.find(i => i.id === state.modalItem.id);
    if(existing) {
        if(existing.quantity + state.modalQty <= state.modalItem.stock) existing.quantity += state.modalQty;
        else return toast("Stock insuficiente", "error");
    } else {
        state.cart.push({...state.modalItem, quantity: state.modalQty});
    }
    saveCart(); updateCartUI(); closeModal('qty-modal'); toast("Agregado", "success");
    if(checkout) toggleCart();
}

function updateCartUI() {
    const list = document.getElementById('cart-list');
    list.innerHTML = '';
    let total = 0, count = 0;
    state.cart.forEach(i => {
        total += i.price * i.quantity; count += i.quantity;
        list.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:10px;">
                <div><b>${i.name}</b><br>$${i.price} x ${i.quantity}</div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <button class="qty-btn" style="width:30px; height:30px; font-size:1rem;" onclick="cartQty(${i.id}, -1)">-</button>
                    <span>${i.quantity}</span>
                    <button class="qty-btn" style="width:30px; height:30px; font-size:1rem;" onclick="cartQty(${i.id}, 1)">+</button>
                </div>
            </div>`;
    });
    const net = Math.round(total/1.19);
    document.getElementById('cart-net').innerText = `$${net.toLocaleString('es-CL')}`;
    document.getElementById('cart-tax').innerText = `$${(total-net).toLocaleString('es-CL')}`;
    document.getElementById('cart-total').innerText = `$${total.toLocaleString('es-CL')}`;
    document.getElementById('cart-count').innerText = count;
    document.getElementById('chk-total').innerText = `$${total.toLocaleString('es-CL')}`;
}

function cartQty(id, d) {
    const i = state.cart.find(x => x.id === id);
    const p = state.products.find(x => x.id === id);
    if(d > 0 && i.quantity >= p.stock) return toast("Max Stock", "error");
    i.quantity += d;
    if(i.quantity <= 0) state.cart = state.cart.filter(x => x.id !== id);
    saveCart(); updateCartUI();
}

// --- AUTH & CHECKOUT ---
async function login() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ identifier: user, password: pass })
        });
        if(!res.ok) throw new Error();
        const data = await res.json();
        state.user = data.user; state.token = data.access_token;
        saveSession(); updateUI(); closeModal('login-modal'); toast(`Hola ${state.user.name}`, "success");
    } catch { toast("Credenciales inválidas", "error"); }
}

async function register() {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ name, email, password: pass })
        });
        if(!res.ok) throw new Error((await res.json()).detail);
        closeModal('register-modal'); openModal('login-modal'); toast("Cuenta creada", "success");
    } catch(e) { toast(e.message, "error"); }
}

function openCheckout() {
    if(state.cart.length === 0) return toast("Carrito vacío", "error");
    if(!state.user) { toast("Inicia sesión", "info"); return openModal('login-modal'); }
    document.getElementById('chk-email').innerText = state.user.email;
    toggleCart(); openModal('checkout-modal');
}

async function processPayment() {
    try {
        const order = {
            customer_email: state.user.email,
            items: state.cart.map(i => ({ product_id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
            total: state.cart.reduce((s, i) => s + i.price * i.quantity, 0)
        };
        const res = await fetch(`${API_URL}/orders`, {
            method: 'POST', headers: getAuth(), body: JSON.stringify(order)
        });
        if(!res.ok) throw new Error((await res.json()).detail);
        state.cart = []; saveCart(); updateCartUI(); fetchProducts();
        closeModal('checkout-modal'); toast("Pedido Exitoso!", "success");
    } catch(e) { toast(e.message, "error"); }
}

// --- ADMIN ---
async function saveProduct() {
    const id = parseInt(document.getElementById('adm-id').value);
    const data = {
        id,
        name: document.getElementById('adm-name').value,
        category: document.getElementById('adm-cat').value,
        price: parseInt(document.getElementById('adm-price').value),
        stock: parseInt(document.getElementById('adm-stock').value),
        image: document.getElementById('adm-img').value
    };
    const exists = state.products.some(p => p.id === id);
    try {
        await fetch(`${API_URL}/products${exists ? '/'+id : ''}`, {
            method: exists ? 'PUT' : 'POST', headers: getAuth(), body: JSON.stringify(data)
        });
        toast("Guardado", "success"); fetchProducts(); loadAdminTable(); clearForm();
    } catch { toast("Error al guardar", "error"); }
}

// --- UTILS ---
function getAuth() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` }; }
function saveSession() { localStorage.setItem('dw_sess', JSON.stringify({u:state.user, t:state.token})); }
function loadSession() { const s = JSON.parse(localStorage.getItem('dw_sess')); if(s) { state.user=s.u; state.token=s.t; updateUI(); } }
function saveCart() { localStorage.setItem('dw_cart', JSON.stringify(state.cart)); }
function loadCartFromStorage() { const c = JSON.parse(localStorage.getItem('dw_cart')); if(c) { state.cart=c; updateCartUI(); } }
function updateUI() {
    document.getElementById('auth-links').style.display = 'none';
    document.getElementById('user-info').style.display = 'flex';
    document.getElementById('user-name-display').innerText = state.user.name;
    if(state.user.role === 'admin') document.getElementById('admin-link').classList.remove('hidden');
}
function logout() { state.user=null; state.token=null; localStorage.removeItem('dw_sess'); location.reload(); }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
function toggleCart() { 
    const sb = document.getElementById('cart-sidebar'); 
    sb.style.right = sb.style.right === '0px' ? '-400px' : '0px';
    document.getElementById('cart-overlay').style.display = sb.style.right === '0px' ? 'block' : 'none';
}
function toast(msg, type) {
    const t = document.createElement('div'); t.className = `toast ${type}`; t.innerText = msg;
    document.getElementById('toast-box').appendChild(t);
    setTimeout(() => t.remove(), 3000);
}
function nextFocus(e, id) { if(e.key==='Enter') document.getElementById(id).click() || document.getElementById(id).focus(); }

// Funciones Admin Extra (Tablas, Graficos) - Simplificadas por espacio
function toggleAdmin() { document.getElementById('admin-panel').classList.toggle('hidden'); document.getElementById('grid').classList.toggle('hidden'); loadAdminTable(); }
function switchTab(t) { 
    document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${t}`).classList.add('active');
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    if(t==='sales') loadSales();
}
function loadAdminTable() {
    const b = document.getElementById('adm-table-body'); b.innerHTML = '';
    state.products.forEach(p => {
        b.innerHTML += `<tr><td>${p.id}</td><td>${p.name}</td><td>${p.stock}</td><td><button onclick="deleteProd(${p.id})">🗑️</button></td></tr>`;
    });
}
async function deleteProd(id) {
    if(!confirm("¿Eliminar?")) return;
    await fetch(`${API_URL}/products/${id}`, { method: 'DELETE', headers: getAuth() });
    fetchProducts(); loadAdminTable();
}
async function loadSales() {
    const res = await fetch(`${API_URL}/orders`, { headers: getAuth() });
    const orders = await res.json();
    const stats = {};
    document.getElementById('adm-sales-body').innerHTML = '';
    orders.forEach(o => {
        o.items.forEach(i => stats[i.name] = (stats[i.name] || 0) + i.quantity);
        document.getElementById('adm-sales-body').innerHTML += `<tr><td>#${o.id.slice(-4)}</td><td>${o.customer_email}</td><td>$${o.total}</td><td>...</td></tr>`;
    });
    new Chart(document.getElementById('salesChart'), {
        type: 'bar', data: { labels: Object.keys(stats), datasets: [{ label: 'Ventas', data: Object.values(stats), backgroundColor: '#D52B1E' }] }
    });
}
function clearForm() { document.getElementById('adm-id').value = ''; }