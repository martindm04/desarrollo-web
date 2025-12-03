import { api } from './api.js';
import { state } from './state.js';
import { API_URL } from './config.js';
import { toast, openModal, closeModal } from './utils.js';

let isEditingId = null;
let salesChartInstance = null;

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
}

// ... (openOrderHistory y toggleAdminPanel se mantienen igual que antes) ...
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
                    <td style="font-size:0.8rem;">${o.items.map(i=>`${i.quantity}x ${i.name}`).join(', ')}</td>
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
        loadAdminTable();
    }
}

function switchTab(tabName) {
    document.getElementById("view-products").classList.add("hidden");
    document.getElementById("view-sales").classList.add("hidden");
    document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
    
    if (tabName === 'products') {
        document.getElementById("view-products").classList.remove("hidden");
        document.querySelectorAll(".tab-btn")[0].classList.add("active");
        loadAdminTable(); // Recargar tabla al volver
    } else {
        document.getElementById("view-sales").classList.remove("hidden");
        document.querySelectorAll(".tab-btn")[1].classList.add("active");
        loadSalesMetrics();
    }
}

async function loadSalesMetrics() {
    if (!state.user || state.user.role !== 'admin') return;
    try {
        const orders = await api("/orders");
        const totalRev = orders.reduce((s, o) => s + o.total, 0);
        
        document.getElementById("kpi-total").innerText = `$${totalRev.toLocaleString('es-CL')}`;
        document.getElementById("kpi-count").innerText = orders.length;

        renderAdminOrdersTable(orders);
        
        // Pequeño delay para asegurar que el canvas es visible antes de dibujar
        setTimeout(() => renderSalesChart(orders), 100);
    } catch (e) { console.error(e); }
}

function renderAdminOrdersTable(orders) {
    const tbody = document.getElementById("admin-orders-table");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    orders.reverse().forEach(o => {
        const tr = document.createElement("tr");
        // Select con clase dinámica según estado
        const statusClass = `status-${o.status}`;
        
        tr.innerHTML = `
            <td style="font-family:monospace;">${o.id.slice(-4)}</td>
            <td>${o.customer_email.split('@')[0]}</td>
            <td>${o.items.length} items</td>
            <td>$${o.total.toLocaleString('es-CL')}</td>
            <td>
                <select onchange="changeOrderStatus('${o.id}', this.value, this)" 
                        class="status-badge ${statusClass}" 
                        style="border:none; cursor:pointer;">
                    ${['recibido','preparando','listo','entregado'].map(s => 
                        `<option value="${s}" ${o.status===s?'selected':''}>${s.toUpperCase()}</option>`
                    ).join('')}
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderSalesChart(orders) {
    const ctx = document.getElementById('salesChart');
    if(!ctx) return;
    
    const statusCounts = orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
    }, {});
    
    if (salesChartInstance) salesChartInstance.destroy();
    
    salesChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ['#4299E1', '#ECC94B', '#48BB78', '#A0AEC0'],
                borderWidth: 0
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

async function loadAdminTable() {
    const tbody = document.getElementById("adm-table");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Cargando inventario...</td></tr>';

    try {
        state.products = await api("/products");
        tbody.innerHTML = "";
        state.products.forEach(p => {
            const tr = document.createElement("tr");
            // Asegurar URL de imagen
            let img = p.image.startsWith('http') ? p.image : `${API_URL}${p.image.startsWith('/')?'':'/'}${p.image}`;
            
            tr.innerHTML = `
                <td><img src="${img}" style="width:50px; height:50px; object-fit:cover; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);"></td>
                <td style="font-weight:600;">${p.name}</td>
                <td>$${p.price.toLocaleString('es-CL')}</td>
                <td style="font-weight:bold; color:${p.stock<10?'#E53E3E':'#38A169'}">${p.stock}</td>
                <td style="white-space:nowrap;">
                    <button onclick="editProduct(${p.id})" class="action-btn btn-edit" title="Editar">✏️</button>
                    <button onclick="deleteProduct(${p.id})" class="action-btn btn-delete" title="Eliminar">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Error de conexión</td></tr>';
    }
}

// ... Resto de funciones (handleFileUpload, saveProduct, deleteProduct, etc.) mantienen su lógica pero se benefician del CSS
// Asegúrate de copiar las funciones handleFileUpload, saveProduct, deleteProduct, clearForm, editProduct del código anterior.
// Solo agrego changeOrderStatus modificado para actualizar color en tiempo real
async function changeOrderStatus(id, status, selectElem) {
    try { 
        await api(`/orders/${id}/status`, "PATCH", { status }); 
        toast("Estado actualizado");
        // Actualizar color visualmente sin recargar
        if(selectElem) {
            selectElem.className = `status-badge status-${status}`;
        }
        loadSalesMetrics(); // Refrescar gráfico
    }
    catch(e) { toast("Error", "error"); }
}

// Copiar funciones restantes del admin.js original aquí para que no falten (saveProduct, etc.)
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
    } catch (e) { toast(e.message || "Error al guardar", "error"); }
}
async function deleteProduct(id) {
    if(!confirm("¿Borrar?")) return;
    try { await api(`/products/${id}`, "DELETE"); loadAdminTable(); }
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