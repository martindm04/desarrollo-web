import { api } from './api.js';
import { state } from './state.js';
import { toast, closeModal, openModal } from './utils.js';

export function initAuth() {
    loadSession();
    window.login = login;
    window.register = register;
    window.logout = logout;
}

function saveSession() { 
    localStorage.setItem("dw_sess", JSON.stringify({u:state.user, t:state.token})); 
}

function loadSession() { 
    const s = JSON.parse(localStorage.getItem("dw_sess")); 
    if(s) { 
        state.user = s.u; 
        state.token = s.t; 
        updateAuthUI(); 
    } 
}

async function login() {
    const u = document.getElementById("login-user").value;
    const p = document.getElementById("login-pass").value;
    
    if(!u || !p) return toast("Datos incompletos", "error");

    try {
        const data = await api("/login", "POST", { identifier: u, password: p });
        state.user = data.user; 
        state.token = data.access_token;
        saveSession(); 
        updateAuthUI(); 
        closeModal("login-modal");
        toast(`¡Hola ${state.user.name}!`, "success");
    } catch (e) { 
        toast(e.message || "Error de login", "error"); 
    }
}

async function register() {
    const name = document.getElementById("reg-name").value;
    const email = document.getElementById("reg-email").value;
    const pass = document.getElementById("reg-pass").value;

    if (!name || !email || !pass) return toast("Completa todo", "error");
    if (pass.length < 8) return toast("Mínimo 8 caracteres", "error");

    try {
        await api("/register", "POST", { name, email, password: pass });
        toast("Cuenta creada"); 
        closeModal("register-modal"); 
        openModal("login-modal");
    } catch (e) { 
        toast(e.message || "Error al registrar", "error"); 
    }
}

function logout() {
    state.user = null;
    state.token = null;
    localStorage.removeItem("dw_sess"); 
    window.location.reload();
}

export function updateAuthUI() {
    const authLinks = document.getElementById("auth-links");
    const userInfo = document.getElementById("user-info");
    const mobileProfile = document.querySelectorAll(".nav-item")[3];
    const adminLink = document.getElementById("admin-link");

    if (state.user) {
        if(authLinks) authLinks.classList.add("hidden");
        if(userInfo) {
            userInfo.classList.remove("hidden");
            userInfo.style.display = "flex";
        }
        document.getElementById("user-name-display").innerText = state.user.name.split(' ')[0];
        
        if(state.user.role === 'admin' && adminLink) {
            adminLink.classList.remove("hidden");
            createMobileAdminBtn();
        }
        
        if(mobileProfile) mobileProfile.innerHTML = `<span>👤</span><small>${state.user.name.split(' ')[0]}</small>`;

    } else {
        if(authLinks) authLinks.classList.remove("hidden");
        if(userInfo) userInfo.classList.add("hidden");
        if(mobileProfile) mobileProfile.innerHTML = `<span>👤</span><small>Perfil</small>`;
        
        const btn = document.getElementById("mobile-admin-btn");
        if(btn) btn.remove();
    }
}

function createMobileAdminBtn() {
    if(document.getElementById("mobile-admin-btn")) return;
    if(window.innerWidth > 768) return;

    const btn = document.createElement("button");
    btn.id = "mobile-admin-btn";
    btn.innerHTML = "⚙️";
    btn.onclick = () => window.toggleAdminPanel(); 
    btn.style.cssText = "position:fixed; bottom:90px; right:20px; width:50px; height:50px; border-radius:50%; background:#2d3748; color:white; font-size:1.5rem; border:none; box-shadow:0 4px 10px rgba(0,0,0,0.3); z-index:4500;";
    document.body.appendChild(btn);
}
