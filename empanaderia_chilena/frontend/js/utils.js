export function toast(msg, type="info") {
    const box = document.getElementById("toast-box");
    if(!box) return;
    
    const t = document.createElement("div");
    t.innerText = msg;
    t.style.cssText = `background:${type==='error'?'#e53e3e':'#2d3748'}; color:white; padding:10px 20px; border-radius:20px; margin-top:10px; box-shadow:0 4px 10px rgba(0,0,0,0.2); font-size:0.9rem; animation: slideIn 0.3s;`;
    
    box.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

export function openModal(id) { 
    const el = document.getElementById(id);
    if(el) el.classList.add("active");
}

export function closeModal(id) { 
    const el = document.getElementById(id);
    if(el) el.classList.remove("active");
}

export function closeModals() { 
    document.querySelectorAll('.modal').forEach(m => m.classList.remove("active"));
}

export function renderSkeletons() {
    const container = document.getElementById("home-view");
    if(!container) return;
    container.innerHTML = '<div class="shelf-container" style="overflow:hidden;">' + 
        Array(4).fill('<div class="card-skeleton"><div class="skeleton sk-img"></div><div class="skeleton sk-line"></div><div class="skeleton sk-btn"></div></div>').join('') + 
        '</div>';
}