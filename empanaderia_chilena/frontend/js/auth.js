import { api } from './api.js';
import { state } from './state.js';
import { toast, closeModal, openModal } from './utils.js';

export function initAuth() {
    loadSession();
    window.login = login;
    window.register = register;
    window.logout = logout;
    
    // Validación email en tiempo real
    const emailInput = document.getElementById('login-user');
    if(emailInput) {
        emailInput.addEventListener('input', (e) => {
            const val = e.target.value;
            const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
            if(val.length > 0 && !isValid && val.includes('@')) e.target.classList.add('error');
            else e.target.classList.remove('error');
        });
    }
}

function saveSession() { 
    localStorage.setItem("dw_sess", JSON.stringify({u:state.user, t:state.token})); 
}

function loadSession() { 
    try {
        const s = JSON.parse(localStorage.getItem("dw_sess")); 
        if(s) { 
            state.user = s.u; 
            state.token = s.t; 
            updateAuthUI(); 
        } 
    } catch(e) { localStorage.removeItem("dw_sess"); }
}

async function login() {
    const u = document.getElementById("login-user").value;
    const p = document.getElementById("login-pass").value;
    if(!u || !p) return toast("Ingresa datos", "error");

    try {
        const data = await api("/login", "POST", { identifier: u, password: p });
        state.user = data.user; state.token = data.access_token;
        saveSession(); updateAuthUI(); closeModal("login-modal");
        toast(`¡Hola ${state.user.name.split(' ')[0]}!`, "success");
    } catch (e) { toast("Error login", "error"); }
}

async function register() {
    const name = document.getElementById("reg-name").value;
    const email = document.getElementById("reg-email").value;
    const pass = document.getElementById("reg-pass").value;
    if (!name || !email || !pass) return toast("Faltan datos", "error");

    try {
        await api("/register", "POST", { name, email, password: pass });
        toast("Creado. Inicia sesión.", "success"); 
        closeModal("register-modal"); openModal("login-modal");
    } catch (e) { toast("Error registro", "error"); }
}

function logout() {
    state.user = null; state.token = null;
    localStorage.removeItem("dw_sess"); 
    window.location.reload();
}

export function updateAuthUI() {
    const authLinks = document.getElementById("auth-links");
    const userInfo = document.getElementById("user-info");
    const adminLink = document.getElementById("admin-link");
    const mobileProfile = document.querySelectorAll(".nav-item")[3];

    if (state.user) {
        if(authLinks) authLinks.classList.add("hidden");
        if(userInfo) {
            userInfo.classList.remove("hidden");
            userInfo.style.display = "flex";
        }
        document.getElementById("user-name-display").innerText = state.user.name.split(' ')[0];
        
        if(state.user.role === 'admin' && adminLink) {
            adminLink.classList.remove("hidden");
            // createMobileAdminBtn(); <-- ELIMINADO PARA EVITAR SUPERPOSICIÓN
        }
        
        // Indicador visual en menú móvil
        if(mobileProfile) mobileProfile.innerHTML = `<i class='bx bxs-user-circle' style='color:var(--primary)'></i><small style='color:var(--primary)'>${state.user.name.split(' ')[0]}</small>`;

    } else {
        if(authLinks) authLinks.classList.remove("hidden");
        if(userInfo) userInfo.classList.add("hidden");
        if(mobileProfile) mobileProfile.innerHTML = `<i class='bx bx-user-circle'></i><small>Perfil</small>`;
    }
}