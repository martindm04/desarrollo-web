// --- VARIABLES GLOBALES ---
const grid = document.getElementById('product-grid');
const searchInput = document.getElementById('search-bar');
const categoryFilter = document.getElementById('category-filter');
const noResultsMsg = document.getElementById('no-results');

// Carrito (Sidebar)
const cartSidebar = document.getElementById('cart-sidebar');
const cartOverlay = document.getElementById('cart-overlay');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total-price');
const cartCountElement = document.getElementById('cart-count');

// Estado de la aplicación
let productsDB = []; // Productos traídos del backend
let cart = [];       // Carrito de compras (Memoria)

// --- 1. CONEXIÓN BACKEND ---
async function fetchProducts() {
    try {
        const response = await fetch('http://127.0.0.1:8000/products');
        if (!response.ok) throw new Error("Error servidor");
        productsDB = await response.json();
        renderProducts(productsDB);
    } catch (error) {
        console.error(error);
        grid.innerHTML = `<p style="color:red; text-align:center;">⚠ Error de conexión con Backend</p>`;
    }
}

// --- 2. RENDERIZADO CATÁLOGO ---
function renderProducts(products) {
    grid.innerHTML = ''; 
    if (products.length === 0) {
        noResultsMsg.classList.remove('hidden');
        return;
    } else {
        noResultsMsg.classList.add('hidden');
    }

    products.forEach(product => {
        const isOutOfStock = product.stock === 0;
        const btnText = isOutOfStock ? "Agotado" : "Agregar";
        const btnDisabled = isOutOfStock ? "disabled" : "";

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div style="height:150px; background:#eee; display:flex; align-items:center; justify-content:center;">
                <span>${product.image}</span> 
            </div>
            <div class="card-body">
                <h3 class="card-title">${product.name}</h3>
                <span class="card-category">${product.category}</span>
                <div style="display:flex; justify-content:space-between; margin-top:auto;">
                    <p class="card-price">$${product.price}</p>
                    <small style="color:${product.stock < 5 ? 'red' : 'green'}">Stock: ${product.stock}</small>
                </div>
            </div>
            <button class="btn-add" ${btnDisabled} onclick="addToCart(${product.id})">
                ${btnText}
            </button>
        `;
        grid.appendChild(card);
    });
}

// --- 3. LÓGICA DEL CARRITO (ÉPICA 4) ---

// Mostrar/Ocultar Sidebar
function toggleCart() {
    cartSidebar.classList.toggle('active');
    cartOverlay.classList.toggle('active');
}

// Agregar al Carrito
function addToCart(id) {
    // Verificar si el producto ya está en el carrito
    const existingItem = cart.find(item => item.id === id);
    const productInfo = productsDB.find(p => p.id === id);

    if (existingItem) {
        // Si ya existe, sumamos 1 a la cantidad (validando stock)
        if (existingItem.quantity < productInfo.stock) {
            existingItem.quantity++;
        } else {
            alert("¡No queda más stock de esta empanada!");
            return;
        }
    } else {
        // Si no existe, lo agregamos con cantidad 1
        cart.push({ ...productInfo, quantity: 1 });
    }

    updateCartUI();
    // Abrir el carrito automáticamente al agregar
    if (!cartSidebar.classList.contains('active')) toggleCart();
}

// Modificar Cantidad (+ / -)
function changeQuantity(id, delta) {
    const item = cart.find(i => i.id === id);
    const productInfo = productsDB.find(p => p.id === id);

    item.quantity += delta;

    // Si la cantidad baja a 0, eliminar del carrito
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.id !== id);
    } 
    // Validar que no supere el stock real
    else if (item.quantity > productInfo.stock) {
        item.quantity = productInfo.stock;
        alert("Stock máximo alcanzado");
    }

    updateCartUI();
}

// Renderizar Carrito y Calcular Totales
function updateCartUI() {
    cartItemsContainer.innerHTML = '';
    let total = 0;
    let totalCount = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        totalCount += item.quantity;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>$${item.price} x ${item.quantity} = <strong>$${itemTotal}</strong></p>
            </div>
            <div class="cart-controls">
                <button onclick="changeQuantity(${item.id}, -1)">-</button>
                <span>${item.quantity}</span>
                <button onclick="changeQuantity(${item.id}, 1)">+</button>
            </div>
        `;
        cartItemsContainer.innerHTML += div.outerHTML;
    });

    // Actualizar textos
    cartTotalElement.innerText = `$${total}`;
    cartCountElement.innerText = totalCount;

    // Mensaje vacío
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align:center; color:#888;">Tu carrito está vacío</p>';
    }
}

// Filtros (igual que antes)
function filterProducts() {
    const searchText = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    const filtered = productsDB.filter(product => {
        return product.name.toLowerCase().includes(searchText) && 
               (selectedCategory === 'all' || product.category === selectedCategory);
    });
    renderProducts(filtered);
}

searchInput.addEventListener('input', filterProducts);
categoryFilter.addEventListener('change', filterProducts);

// --- ÉPICA 5: PROCESO DE PAGO Y ORDEN ---

async function checkout() {
    if (cart.length === 0) {
        alert("El carrito está vacío");
        return;
    }

    // 1. Simular identificación del usuario (US-01 pendiente)
    const email = prompt("Ingresa tu correo para confirmar el pedido:");
    if (!email) return;

    // 2. Preparar datos para el Backend (coincidiendo con models.py)
    const orderData = {
        customer_email: email,
        items: cart.map(item => ({
            product_id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        })),
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };

    try {
        // 3. Enviar al Backend (POST)
        const response = await fetch('http://127.0.0.1:8000/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) throw new Error("Error al crear orden");

        const result = await response.json();
        console.log("Orden creada:", result);

        // 4. Simular Redirección a Pasarela de Pago (US-10)
        alert(`✅ Orden #${result.id} creada.\nRedirigiendo a WebPay... (Simulación)\n\n¡Pago Exitoso!`);
        
        // 5. Limpiar carrito y cerrar
        cart = [];
        updateCartUI();
        toggleCart();

    } catch (error) {
        console.error(error);
        alert("Hubo un error al procesar tu pedido.");
    }
}

// --- ÉPICA 1: AUTENTICACIÓN (LOGIN / REGISTRO) ---

let currentUser = null; // Variable para guardar al usuario logueado

// Abrir/Cerrar Modales
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// 1. Función de REGISTRO
async function registerUser() {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;

    if (!name || !email || !password) {
        alert("Por favor completa todos los campos");
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:8000/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail);
        }

        alert("¡Usuario creado! Ahora puedes iniciar sesión.");
        closeModal('register-modal');
        openModal('login-modal'); // Abrir login automáticamente

    } catch (error) {
        alert("Error: " + error.message);
    }
}

// 2. Función de LOGIN
async function loginUser() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;

    try {
        const response = await fetch('http://127.0.0.1:8000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name: "temp" }) // name es requerido por el modelo pero no se usa en login
        });

        if (!response.ok) throw new Error("Credenciales incorrectas");

        const data = await response.json();
        
        // Guardar usuario en variable global
        currentUser = data;
        
        // Actualizar UI (Ocultar enlaces, mostrar nombre)
        document.getElementById('auth-links').style.display = 'none';
        document.getElementById('user-info').style.display = 'inline';
        // Verificar rol para mostrar Admin Panel
        if (currentUser.role === 'admin' || currentUser.email.includes('@admin.com')) {
            document.getElementById('admin-link').style.display = 'inline';
        }
        document.getElementById('user-name-display').innerText = currentUser.name;

        closeModal('login-modal');
        alert("¡Bienvenido " + currentUser.name + "!");

    } catch (error) {
        alert("Error: " + error.message);
    }
}

// 3. Función de LOGOUT
function logout() {
    currentUser = null;
    document.getElementById('auth-links').style.display = 'inline';
    document.getElementById('user-info').style.display = 'none';
    alert("Sesión cerrada");
}

// --- ACTUALIZACIÓN DEL CHECKOUT (INTEGRACIÓN) ---
// Sobrescribimos la función checkout anterior para usar el usuario real
async function checkout() {
    if (cart.length === 0) {
        alert("El carrito está vacío");
        return;
    }

    // Validar si hay usuario logueado
    if (!currentUser) {
        alert("Debes iniciar sesión para comprar.");
        openModal('login-modal'); // Abrir login automáticamente
        return;
    }

    // Usar el email del usuario logueado automáticamente
    const orderData = {
        customer_email: currentUser.email,
        items: cart.map(item => ({
            product_id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        })),
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };

    try {
        const response = await fetch('http://127.0.0.1:8000/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) throw new Error("Error al crear orden");

        const result = await response.json();
        alert(`✅ Orden #${result.id} creada para ${currentUser.name}.\nRedirigiendo a WebPay...`);
        
        cart = [];
        updateCartUI();
        toggleCart();

    } catch (error) {
        console.error(error);
        alert("Error al procesar pedido");
    }
}
// --- ÉPICA 6: LÓGICA DEL PANEL DE ADMINISTRACIÓN ---

// Mostrar/Ocultar Panel
function toggleAdminPanel() {
    const panel = document.getElementById('admin-panel');
    const mainGrid = document.getElementById('product-grid');
    const hero = document.querySelector('.hero');
    
    if (panel.classList.contains('hidden')) {
        // Mostrar Admin, ocultar tienda
        panel.classList.remove('hidden');
        mainGrid.classList.add('hidden');
        hero.classList.add('hidden');
        loadAdminTable(); // Cargar datos actualizados
    } else {
        // Volver a la tienda
        panel.classList.add('hidden');
        mainGrid.classList.remove('hidden');
        hero.classList.remove('hidden');
        fetchProducts(); // Recargar catálogo cliente
    }
}

// Cargar la tabla de productos
function loadAdminTable() {
    const tbody = document.getElementById('admin-table-body');
    tbody.innerHTML = '';

    productsDB.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:10px; border-bottom:1px solid #eee;">${p.id}</td>
            <td style="padding:10px; border-bottom:1px solid #eee;">${p.name}</td>
            <td style="padding:10px; border-bottom:1px solid #eee;">$${p.price}</td>
            <td style="padding:10px; border-bottom:1px solid #eee;">${p.stock}</td>
            <td style="padding:10px; border-bottom:1px solid #eee;">
                <button onclick="editProduct(${p.id})" style="background:#f1c40f; border:none; padding:5px; cursor:pointer;">✏️</button>
                <button onclick="deleteProduct(${p.id})" style="background:#e74c3c; color:white; border:none; padding:5px; cursor:pointer;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Guardar Producto (Crear o Editar)
async function saveProduct() {
    const id = parseInt(document.getElementById('adm-id').value);
    const name = document.getElementById('adm-name').value;
    const category = document.getElementById('adm-category').value;
    const price = parseInt(document.getElementById('adm-price').value);
    const stock = parseInt(document.getElementById('adm-stock').value);
    const image = document.getElementById('adm-image').value;

    if (!id || !name) return alert("Faltan datos");

    const productData = { id, name, category, price, stock, image };
    
    // Decidir si es CREAR (POST) o ACTUALIZAR (PUT)
    // Verificamos si el ID ya existe en la lista actual
    const exists = productsDB.some(p => p.id === id);
    const method = exists ? 'PUT' : 'POST';
    const url = exists 
        ? `http://127.0.0.1:8000/products/${id}` 
        : 'http://127.0.0.1:8000/products';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });

        if (!response.ok) throw new Error("Error al guardar");
        
        alert(exists ? "Producto Actualizado" : "Producto Creado");
        
        // Recargar datos
        const res = await fetch('http://127.0.0.1:8000/products');
        productsDB = await res.json();
        loadAdminTable();
        clearAdminForm();

    } catch (error) {
        console.error(error);
        alert("Error: " + error.message);
    }
}

// Cargar datos en el formulario para editar
function editProduct(id) {
    const p = productsDB.find(p => p.id === id);
    document.getElementById('adm-id').value = p.id;
    document.getElementById('adm-name').value = p.name;
    document.getElementById('adm-category').value = p.category;
    document.getElementById('adm-price').value = p.price;
    document.getElementById('adm-stock').value = p.stock;
    document.getElementById('adm-image').value = p.image;
}

// Eliminar Producto
async function deleteProduct(id) {
    if(!confirm("¿Seguro que quieres eliminar este producto?")) return;

    try {
        const response = await fetch(`http://127.0.0.1:8000/products/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error("Error al eliminar");
        
        alert("Producto eliminado");
        // Recargar
        const res = await fetch('http://127.0.0.1:8000/products');
        productsDB = await res.json();
        loadAdminTable();

    } catch (error) {
        alert(error.message);
    }
}

function clearAdminForm() {
    document.getElementById('adm-id').value = '';
    document.getElementById('adm-name').value = '';
    document.getElementById('adm-price').value = '';
    document.getElementById('adm-stock').value = '';
    document.getElementById('adm-image').value = '';
}

// Iniciar
fetchProducts();