import { api } from './api.js';
import { state } from './state.js';
import { API_URL } from './config.js';
import { toast, openModal, closeModal } from './utils.js';
import { loadProducts } from './products.js';

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
                    <td style="font-weight:bold; font-size:0.85rem;">#${o.id.slice(-4)}</td>
                    <td>$${o.total.toLocaleString('es-CL')}</td>
                    <td><span class="badge" style="position:static; background:${o.status==='recibido'?'#3182ce':'#48bb78'};">${o.status}</span></td>
                    <td style="font-size:0.8rem;">${o.items.map(i=>`${i.quantity}x ${i.name}`).join(', ')}</td>
                `;
                tbody.appendChild(tr);
            });
        }
        openModal("history-modal");
    } catch (e) {
        toast("Error al cargar historial", "error");
    }
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
    document.getElementById("view-products").classList.remove("active");
    document.getElementById("view-sales").classList.remove("active");
    document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
    
    if (tabName === 'products') {
        document.getElementById("view-products").classList.add("active");
        document.querySelectorAll(".tab-btn")[0].classList.add("active");
    } else {
        document.getElementById("view-sales").classList.add("active");
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
        renderSalesChart(orders);
        renderAdminOrdersTable(orders);

    } catch (e) { console.error(e); }
}

function renderAdminOrdersTable(orders) {
    const tbody = document.getElementById("admin-orders-table");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    orders.reverse().forEach(o => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-size:0.85rem;">...${o.id.slice(-4)}</td>
            <td>${o.customer_email.split('@')[0]}</td>
            <td>${o.items.length} items</td>
            <td>$${o.total.toLocaleString('es-CL')}</td>
            <td>
                <select onchange="changeOrderStatus('${o.id}', this.value)" style="padding:5px; border-radius:4px;">
                    ${['recibido','preparando','listo','entregado'].map(s => `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadAdminTable() {
    const tbody = document.getElementById("adm-table");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';

    try {
        state.products = await api("/products");
        tbody.innerHTML = "";
        state.products.forEach(p => {
            const tr = document.createElement("tr");
            let img = p.image.startsWith('http') ? p.image : `${API_URL}${p.image.startsWith('/')?'':'/'}${p.image}`;
            
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

async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    const btn = input.previousElementSibling;
    
    try {
        const res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });
        if(!res.ok) throw new Error();
        const data = await res.json();
        document.getElementById("adm-img-url").value = data.url;
        
        const preview = document.getElementById("preview-img");
        if(preview) {
            preview.src = `${API_URL}${data.url}`;
            preview.style.display = "block";
        }
        toast("Imagen lista", "success");
    } catch(e) {
        toast("Error subida", "error");
    }
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
    } catch (e) {
        toast(e.message || "Error al guardar", "error");
    }
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
    const preview = document.getElementById("preview-img");
    if(preview) preview.style.display = "none";
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
    
    const preview = document.getElementById("preview-img");
    if(preview) {
        preview.src = p.image.startsWith('http') ? p.image : `${API_URL}${p.image}`;
        preview.style.display = "block";
    }
    document.querySelector("#view-products .btn-primary").innerText = "Actualizar";
    document.querySelector(".admin-container").scrollTo({top:0, behavior:'smooth'});
}

async function changeOrderStatus(id, status) {
    try { await api(`/orders/${id}/status`, "PATCH", { status }); toast("Estado actualizado"); }
    catch(e) { toast("Error", "error"); }
}

function renderSalesChart(orders) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    const statusCounts = orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
    }, {});
    
    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);

    if (salesChartInstance) salesChartInstance.destroy();
    
    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '# de Pedidos por Estado',
                data: data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)', 
                    'rgba(54, 162, 235, 0.7)', 
                    'rgba(255, 206, 86, 0.7)', 
                    'rgba(75, 192, 192, 0.7)'  
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });
}