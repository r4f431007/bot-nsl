const API_URL = window.location.origin;

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');

let checkingAuth = false;

async function checkAuth() {
    if (checkingAuth) return;
    checkingAuth = true;
    
    try {
        const response = await fetch(`${API_URL}/api/check-auth`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.authenticated) {
            window.location.replace('/');
        }
    } catch (error) {
        console.error('Error checking auth:', error);
    } finally {
        checkingAuth = false;
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    emailInput.classList.remove('error');
    passwordInput.classList.remove('error');
    errorMessage.classList.remove('show');
    
    if (!email || !password) {
        showError('⚠️ Por favor completa todos los campos');
        if (!email) emailInput.classList.add('error');
        if (!password) passwordInput.classList.add('error');
        return;
    }
    
    loginBtn.disabled = true;
    loginBtn.classList.add('loading');
    
    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            window.location.replace('/');
        } else {
            showError(data.error || '❌ Error al iniciar sesión');
            emailInput.classList.add('error');
            passwordInput.classList.add('error');
            loginBtn.disabled = false;
            loginBtn.classList.remove('loading');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('❌ Error de conexión. Verifica tu conexión a internet.');
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
    }
});

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    
    setTimeout(() => {
        errorMessage.classList.remove('show');
    }, 5000);
}

emailInput.addEventListener('input', () => {
    emailInput.classList.remove('error');
    errorMessage.classList.remove('show');
});

passwordInput.addEventListener('input', () => {
    passwordInput.classList.remove('error');
    errorMessage.classList.remove('show');
});

checkAuth();