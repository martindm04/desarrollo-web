import { api } from './api.js';
import { state } from './state.js';
import { API_URL } from './config.js';
import { renderSkeletons } from './utils.js';

let carouselInterval = null;

export function initProducts() {
    renderSkeletons();
    loadProducts();

    window.showFullCatalog = showFullCatalog;
    window.showHome = showHome;
}

export async function loadProducts() {
    try {
        state.products = await api("/products");
        renderHome();
        initCarousel(); 
    } catch (e) {
        console.error(e);
        const container = document.getElementById("home-view");
        if(container) container.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Error de conexión</div>`;
    }
}

function createCardHTML(p) {
    let imgUrl = p.image;
    if (!imgUrl.startsWith('http')) {
        imgUrl = imgUrl.startsWith('/') ? `${API_URL}${imgUrl}` : `${API_URL}/static/images/${imgUrl}`;
    }
    const hasStock = p.stock > 0;

    return `
        <div class="card-img">
            <span class="badge ${p.category}">${p.category}</span>
            <img src="${imgUrl}" onerror="this.src='https://via.placeholder.com/150'" loading="lazy" alt="${p.name}">
        </div>
        <div class="card-info">
            <h3>${p.name}</h3>
            <div class="card-footer">
                <div class="price-info">
                    <div class="price-tag">$${p.price.toLocaleString('es-CL')}</div>
                    <small style="font-size:0.7rem; color:${hasStock ? '#718096' : '#e53e3e'}">
                        ${hasStock ? 'Disponible' : 'Agotado'}
                    </small>
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
    if(gridView) gridView.classList.add("hidden");
    container.innerHTML = "";

    const categories = [
        { id: 'horno', title: '🔥 De Horno' },
        { id: 'frita', title: '🍳 Fritas' },
        { id: 'bebida', title: '🥤 Bebidas' },
        { id: 'acompañamiento', title: '🍟 Extras' }
    ];

    categories.forEach(cat => {
        const products = state.products.filter(p => p.category === cat.id);
        if (products.length > 0) {
            const section = document.createElement("section");
            section.innerHTML = `
                <div class="category-header">
                    <div class="category-title">${cat.title}</div>
                    <div class="view-all-link" onclick="showFullCatalog('${cat.id}')">Ver más</div>
                </div>
                <div class="shelf-container">
                    ${products.map(p => createCardHTML(p)).join('')}
                </div>
            `;
            container.appendChild(section);
        }
    });

    container.innerHTML += `
        <div style="text-align:center; margin: 30px 0; padding-bottom: 40px;">
            <button class="btn-floating-all" onclick="showFullCatalog('all')">
                Ver Menú Completo
            </button>
        </div>
    `;
}

function showFullCatalog(filterCat = 'all') {
    document.getElementById("home-view").classList.add("hidden");
    const fullGrid = document.getElementById("full-grid-view");
    fullGrid.classList.remove("hidden");
    
    const title = document.getElementById("grid-title");
    if(title) title.innerText = filterCat === 'all' ? "Todo el Menú" : filterCat.toUpperCase();

    renderGrid(filterCat);
    window.scrollTo(0,0);
}

function showHome() {
    document.getElementById("full-grid-view").classList.add("hidden");
    document.getElementById("home-view").classList.remove("hidden");
    window.scrollTo(0,0);
}

function renderGrid(filterCat = 'all') {
    const grid = document.getElementById("grid");
    grid.innerHTML = "";
    
    const filtered = state.products.filter(p => filterCat === 'all' || p.category === filterCat);

    const emptyState = document.getElementById("empty-state");
    if(filtered.length === 0) {
        if(emptyState) emptyState.classList.remove("hidden");
    } else {
        if(emptyState) emptyState.classList.add("hidden");
    }

    filtered.forEach(p => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper'; 
        wrapper.innerHTML = createCardHTML(p);
        grid.appendChild(wrapper);
    });
}

function initCarousel() {
    const track = document.getElementById("carousel-track");
    const container = document.getElementById("hero-carousel");
    
    const featured = state.products.filter(p => p.stock > 0).slice(0, 5);
    
    if (featured.length === 0 || !track) {
        if(container) container.classList.add("hidden");
        return;
    }
    container.classList.remove("hidden");
    
    track.innerHTML = featured.map(p => {
        let img = p.image.startsWith('http') ? p.image : `${API_URL}${p.image.startsWith('/')?'':'/'}${p.image}`;
        return `
            <div class="carousel-slide">
                <div class="slide-content">
                    <span class="badge ${p.category}" style="position:static; display:inline-block; margin-bottom:5px;">${p.category}</span>
                    <h2>${p.name}</h2>
                    <h3 style="color:#555; margin-bottom:15px;">$${p.price.toLocaleString('es-CL')}</h3>
                    <button class="btn-primary" onclick="addToCart(${p.id})" style="width:auto; padding:8px 20px; font-size:0.9rem;">Lo quiero</button>
                </div>
                <img src="${img}" class="slide-img">
            </div>
        `;
    }).join('');

    let index = 0;
    if(carouselInterval) clearInterval(carouselInterval);
    const slides = track.children;
    carouselInterval = setInterval(() => {
        index = (index + 1) % slides.length;
        track.style.transform = `translateX(-${index * 100}%)`;
    }, 4000);
}