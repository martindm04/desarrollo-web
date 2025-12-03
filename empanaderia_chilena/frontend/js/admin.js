import { api } from './api.js';
import { state } from './state.js';
import { API_URL } from './config.js';
import { toast, openModal, closeModal } from './utils.js';
import { loadProducts } from './products.js';

let isEditingId = null;
let salesChartInstance = null;
let currentOrders = []; // Almacenar órdenes para cambiar gráfico sin recargar API
let currentChartType = 'status'; // 'status' o 'products'

export function initAdmin() {
    window.toggleAdminPanel = toggleAdminPanel;
    window.switchTab = switchTab;
    window.loadSalesMetrics = loadSalesMetrics;
    window.handleFileUpload = handleFileUpload;
    window.saveProduct = saveProduct;
    window.clearForm = clearForm;
    window.deleteProduct = deleteProduct;
    window.editProduct = editProduct;
    window.changeOrderStatus = changeOrderStatus;
    window.openOrderHistory = openOrderHistory;
    window.setChartType = setChartType;
}

// --- LÓGICA DE GRÁFICOS ---

function setChartType(type) {
    currentChartType = type;
    
    // Actualizar botones
    document.querySelectorAll('.chart-toggle-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-chart-${type}`).classList.add('active');
    
    // Renderizar gráfico
    renderCurrentChart();
}

async function loadSalesMetrics() {
    if (!state.user || state.user.role !== 'admin') return;
    try {
        currentOrders = await api("/orders");
        
        // Calcular total
        const totalRev = currentOrders.reduce((s, o) => s + o.total, 0);
        document.getElementById("kpi-total").innerText = `$${totalRev.toLocaleString('es-CL')}`;
        document.getElementById("kpi-count").innerText = currentOrders.length;

        renderAdminOrdersTable(currentOrders);
        
        // Renderizar gráfico con delay para asegurar canvas
        setTimeout(() => renderCurrentChart(), 100);

    } catch (e) { console.error("Error métricas:", e); }
}

function renderCurrentChart() {
    if (!currentOrders || currentOrders.length === 0) return;

    if (currentChartType === 'status') {
        renderStatusChart(currentOrders);
    } else {
        renderProductSalesChart(currentOrders);
    }
}

function renderStatusChart(orders) {
    const ctx = getChartContext();
    if (!ctx) return;

    const statusCounts = orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
    }, {});

    createChart(ctx, 'doughnut', {
        labels: Object.keys(statusCounts).map(s => s.toUpperCase()),
        datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: ['#4299E1', '#ECC94B', '#48BB78', '#A0AEC0'],
            borderWidth: 0
        }]
    });
}

function renderProductSalesChart(orders) {
    const ctx = getChartContext();
    if (!ctx) return;

    // Agregar ventas por nombre de producto
    const salesByProduct = {};
    
    orders.forEach(order => {
        order.items.forEach(item => {
            if (!salesByProduct[item.name]) salesByProduct[item.name] = 0;
            salesByProduct[item.name] += (item.price * item.quantity);
        });
    });

    // Ordenar de mayor a menor
    const sortedProducts = Object.entries(salesByProduct)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10); // Top 10

    createChart(ctx, 'bar', {
        labels: sortedProducts.map(([name]) => name),
        datasets: [{
            label: 'Ventas ($)',
            data: sortedProducts.map(([,total]) => total),
            backgroundColor: '#D32F2F',
            borderRadius: 4
        }]
    });
}

function getChartContext() {
    if (typeof Chart === 'undefined') return null;
    const canvas = document.getElementById('salesChart');
    return canvas ? canvas.getContext('2d') : null;
}

function createChart(ctx, type, data) {
    if (salesChartInstance) {
        salesChartInstance.destroy();
    }
    
    salesChartInstance = new Chart(ctx, {
        type: type,
        data: data,
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                legend: { position: 'bottom', display: type === 'doughnut' },
                title: { display: true, text: type === 'doughnut' ? 'Estado de Pedidos' : 'Top Ventas por Producto' }
            },
            scales: type === 'bar' ? { y: { beginAtZero: true } } : {}
        }
    });
}

// --- RESTO DE FUNCIONES (Sin cambios lógicos mayores) ---

async function openOrderHistory() {
    if (!state.user) return toast("Debes iniciar sesión", "error");
    try {
        const orders = await api(`/orders/user/${state.user.email}`);
        const tbody = document.getElementById("history-body");
        const noHistory = document.getElementById("no-history");
        tbody.innerHTML = "";
        if (orders.length === 0) {
            if (noHistory) noHistory.classList.remove("hidden");
        } else {
            if (noHistory) noHistory.classList.add("hidden");
            orders.forEach(o => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="font-weight:bold;">#${o.id.slice(-4)}</td>
                    <td>$${o.total.toLocaleString('es-CL')}</td>
                    <td><span class="status-badge status-${o.status}">${o.status}</span></td>
                    <td style="font-size:0.8rem;">${o.items.length} items</td>
                `;
                tbody.appendChild(tr);
            });
        }
        openModal("history-modal");
    } catch (e) { toast("Error al cargar historial", "error"); }
}

function toggleAdminPanel() {
    const admin = document.getElementById("admin-panel");
    if (admin.classList.contains("open")) {
        admin.classList.remove("open");
        document.body.style.overflow = '';
    } else {
        admin.classList.add("open");
        document.body.style.overflow = 'hidden';
        switchTab('products');
    }
}

function switchTab(tabName) {
    document.getElementById("view-products").classList.add("hidden");
    document.getElementById("view-sales").classList.add("hidden");
    document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
    
    if (tabName === 'products') {
        document.getElementById("view-products").classList.remove("hidden");
        document.querySelectorAll(".tab-btn")[0].classList.add("active");
        loadAdminTable();
    } else {
        document.getElementById("view-sales").classList.remove("hidden");
        document.querySelectorAll(".tab-btn")[1].classList.add("active");
        loadSalesMetrics();
    }
}

function renderAdminOrdersTable(orders) {
    const tbody = document.getElementById("admin-orders-table");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    orders.slice().reverse().slice(0, 20).forEach(o => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-family:monospace;">${o.id.slice(-4)}</td>
            <td>${o.customer_email.split('@')[0]}</td>
            <td>${o.items.length}</td>
            <td>$${o.total.toLocaleString('es-CL')}</td>
            <td>
                <select onchange="changeOrderStatus('${o.id}', this.value, this)" 
                        class="status-badge status-${o.status}">
                    ${['recibido','preparando','listo','entregado'].map(s => 
                        `<option value="${s}" ${o.status===s?'selected':''}>${s.toUpperCase()}</option>`
                    ).join('')}
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadAdminTable() {
    const tbody = document.getElementById("adm-table");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Cargando...</td></tr>';

    try {
        state.products = await api("/products");
        tbody.innerHTML = "";
        state.products.forEach(p => {
            const tr = document.createElement("tr");
            let img = p.image.startsWith('http') ? p.image : `${API_URL}${p.image.startsWith('/')?'':'/'}${p.image}`;
            
            tr.innerHTML = `
                <td><img src="${img}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;"></td>
                <td style="font-weight:600;">${p.name}</td>
                <td>$${p.price.toLocaleString('es-CL')}</td>
                <td style="font-weight:bold; color:${p.stock<10?'#E53E3E':'#38A169'}">${p.stock}</td>
                <td style="white-space:nowrap;">
                    <button onclick="editProduct(${p.id})" class="action-btn btn-edit">✏️</button>
                    <button onclick="deleteProduct(${p.id})" class="action-btn btn-delete">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Error</td></tr>';
    }
}

async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });
        if(!res.ok) throw new Error();
        const data = await res.json();
        document.getElementById("adm-img-url").value = data.url;
        toast("Imagen lista", "success");
    } catch(e) { toast("Error subida", "error"); }
}

async function saveProduct() {
    const id = parseInt(document.getElementById("adm-id").value);
    const name = document.getElementById("adm-name").value;
    const cat = document.getElementById("adm-cat").value;
    const price = parseInt(document.getElementById("adm-price").value);
    const stock = parseInt(document.getElementById("adm-stock").value);
    const img = document.getElementById("adm-img-url").value || "placeholder.jpg";
    if (!id || !name) return toast("Faltan datos", "error");
    const pData = { id, name, category: cat, price, stock, image: img };
    try {
        if (isEditingId) await api(`/products/${isEditingId}`, "PUT", pData);
        else await api("/products", "POST", pData);
        toast("Guardado", "success");
        clearForm();
        loadAdminTable();
        loadProducts();
    } catch (e) { toast(e.message || "Error al guardar", "error"); }
}

async function deleteProduct(id) {
    if(!confirm("¿Borrar?")) return;
    try { await api(`/products/${id}`, "DELETE"); loadAdminTable(); loadProducts(); }
    catch(e) { toast("Error", "error"); }
}

function clearForm() {
    isEditingId = null;
    document.getElementById("adm-id").value = "";
    document.getElementById("adm-id").disabled = false;
    document.getElementById("adm-name").value = "";
    document.getElementById("adm-price").value = "";
    document.getElementById("adm-stock").value = "";
    document.getElementById("adm-img-url").value = "";
    document.querySelector("#view-products .btn-primary").innerText = "Guardar Producto";
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
    document.querySelector("#view-products .btn-primary").innerText = "Actualizar";
    document.querySelector(".admin-container").scrollTo({top:0, behavior:'smooth'});
}

async function changeOrderStatus(id, status, selectElem) {
    try { 
        await api(`/orders/${id}/status`, "PATCH", { status }); 
        toast("Estado actualizado");
        if(selectElem) selectElem.className = `status-badge status-${status}`;
        loadSalesMetrics();
    }
    catch(e) { toast("Error", "error"); }
}