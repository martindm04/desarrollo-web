import { api } from './api.js';
import { state } from './state.js';
import { API_URL } from './config.js';
import { renderSkeletons, toast, openModal } from './utils.js'; // Asegúrate de importar lo necesario

let carouselInterval = null;
let currentSlide = 0;

export function initProducts() {
    renderSkeletons();
    loadProducts();

    // Exponer funciones globales
    window.showFullCatalog = showFullCatalog;
    window.showHome = showHome;
    window.moveCarousel = moveCarousel;
    window.setSlide = setSlide;
    window.filterSticky = filterSticky;
}

export async function loadProducts() {
    try {
        state.products = await api("/products");
        renderHome();
        initCarousel(); 
    } catch (e) {
        console.error(e);
        const container = document.getElementById("home-view");
        if(container) container.innerHTML = `<div style="padding:20px; text-align:center; color:red;">No se pudo conectar con el servidor</div>`;
    }
}

function createCardHTML(p) {
    let imgUrl = p.image;

    // --- FIX CRÍTICO PARA IMÁGENES EN MÓVIL ---
    // Si la base de datos tiene guardado "localhost" o "127.0.0.1", lo limpiamos
    if (imgUrl && (imgUrl.includes('localhost') || imgUrl.includes('127.0.0.1'))) {
        try {
            const urlObj = new URL(imgUrl);
            imgUrl = urlObj.pathname; // Nos quedamos solo con "/static/images/..."
        } catch(e) {}
    }

    // Construimos la URL correcta usando la IP actual (API_URL)
    if (!imgUrl.startsWith('http')) {
        // Limpieza de slashes para evitar errores como "http://ip:8000//static..."
        const cleanBase = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
        const cleanPath = imgUrl.startsWith('/') ? imgUrl : `/${imgUrl}`;
        
        // Si falta la carpeta static, la agregamos (seguridad)
        if (!cleanPath.includes('/static/images') && !cleanPath.includes('/static')) {
             imgUrl = `${cleanBase}/static/images${cleanPath}`;
        } else {
             imgUrl = `${cleanBase}${cleanPath}`;
        }
    }

    const hasStock = p.stock > 0;

    return `
        <div class="card">
            <div class="card-img">
                <span class="badge ${p.category}">${p.category}</span>
                <img src="${imgUrl}" onerror="this.src='https://via.placeholder.com/150?text=Sin+Imagen'" loading="lazy" alt="${p.name}">
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
}

function showFullCatalog(filterCat = 'all') {
    document.getElementById("home-view").classList.add("hidden");
    const fullGrid = document.getElementById("full-grid-view");
    fullGrid.classList.remove("hidden");
    
    const carousel = document.getElementById("hero-carousel");
    if(carousel) carousel.classList.add("hidden");

    const title = document.getElementById("grid-title");
    if(title) title.innerText = filterCat === 'all' ? "Todo el Menú" : filterCat.toUpperCase();

    renderGrid(filterCat);
    window.scrollTo(0,0);
}

function showHome() {
    document.getElementById("full-grid-view").classList.add("hidden");
    document.getElementById("home-view").classList.remove("hidden");
    const carousel = document.getElementById("hero-carousel");
    if(carousel) carousel.classList.remove("hidden");
    window.scrollTo(0,0);
}

function renderGrid(filterCat = 'all') {
    const grid = document.getElementById("grid");
    grid.innerHTML = "";
    const filtered = state.products.filter(p => filterCat === 'all' || p.category === filterCat);
    
    if(filtered.length === 0) {
        document.getElementById("empty-state").classList.remove("hidden");
    } else {
        document.getElementById("empty-state").classList.add("hidden");
        filtered.forEach(p => {
            // No creamos wrapper extra para que el grid CSS funcione directo sobre .card
            grid.innerHTML += createCardHTML(p);
        });
    }
}

function initCarousel() {
    const track = document.getElementById("carousel-track");
    const container = document.getElementById("hero-carousel");
    const dotsContainer = document.getElementById("carousel-dots");
    
    // Filtrar productos con imagen válida
    const featured = state.products.filter(p => p.stock > 0).slice(0, 5);
    
    if (featured.length === 0 || !track) {
        if(container) container.classList.add("hidden");
        return;
    }
    container.classList.remove("hidden");
    
    track.innerHTML = featured.map(p => {
        // Usamos lógica similar para imágenes del carrusel
        let img = p.image;
        if (img && (img.includes('localhost') || img.includes('127.0.0.1'))) {
             try { img = new URL(img).pathname; } catch(e){}
        }
        const cleanBase = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
        if (!img.startsWith('http')) {
             img = img.startsWith('/') ? `${cleanBase}${img}` : `${cleanBase}/static/images/${img}`;
        }

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

    if(dotsContainer) {
        dotsContainer.innerHTML = featured.map((_, i) => 
            `<div class="carousel-dot ${i===0?'active':''}" onclick="setSlide(${i})"></div>`
        ).join('');
    }
    startAutoSlide(featured.length);
}

function startAutoSlide(total) {
    if(carouselInterval) clearInterval(carouselInterval);
    carouselInterval = setInterval(() => { moveCarousel(1, total); }, 5000);
}

function moveCarousel(direction, total = 5) {
    const track = document.getElementById("carousel-track");
    if(!track || !track.children.length) return;
    total = track.children.length;
    currentSlide = (currentSlide + direction + total) % total;
    updateCarouselUI();
}

function setSlide(index) {
    currentSlide = index;
    updateCarouselUI();
    const track = document.getElementById("carousel-track");
    if(track) startAutoSlide(track.children.length);
}

function updateCarouselUI() {
    const track = document.getElementById("carousel-track");
    if(track) track.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    const dots = document.querySelectorAll(".carousel-dot");
    dots.forEach((d, i) => {
        if(i === currentSlide) d.classList.add("active");
        else d.classList.remove("active");
    });
}

function filterSticky(category, btnElement) {
    // 1. Actualizar visualmente los botones
    document.querySelectorAll('.cat-pill').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');

    // 2. Si estamos en modo "Ver todo" (Home), scrollear al Home
    // Si ya estamos en "Full Catalog", filtrar ahí.
    const fullGrid = document.getElementById("full-grid-view");
    
    // Si el carrusel está visible (estamos en home) y seleccionan algo que no sea 'all',
    // podríamos querer ir al catálogo completo automáticamente.
    if (category !== 'all') {
        showFullCatalog(category);
    } else {
        showHome();
    }
}