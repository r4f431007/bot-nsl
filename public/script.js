const API_URL = window.location.origin;

const channelSelect = document.getElementById('channelSelect');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const notification = document.getElementById('notification');

async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/api/check-auth`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error checking auth:', error);
        window.location.href = '/login.html';
    }
}

async function loadChannels() {
    try {
        const response = await fetch(`${API_URL}/api/channels`, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        
        const data = await response.json();
        
        if (!data.success) {
            showNotification('❌ ' + (data.error || 'Error cargando canales'), 'error');
            return;
        }
        
        channelSelect.innerHTML = '<option value="">Selecciona un canal</option>';
        
        if (data.channels.length === 0) {
            channelSelect.innerHTML = '<option value="">No hay canales disponibles</option>';
            showNotification('⚠️ No se encontraron canales. Verifica que el bot esté en un servidor.', 'error');
            return;
        }
        
        data.channels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = `${channel.guild} - #${channel.name}`;
            channelSelect.appendChild(option);
        });
    } catch (error) {
        showNotification('❌ Error de conexión al cargar canales', 'error');
        console.error(error);
    }
}

async function sendMessage() {
    const channelId = channelSelect.value;
    const message = messageInput.value.trim();
    
    if (!channelId) {
        showNotification('⚠️ Por favor selecciona un canal', 'error');
        return;
    }
    
    if (!message) {
        showNotification('⚠️ Por favor escribe un mensaje', 'error');
        return;
    }
    
    sendBtn.disabled = true;
    sendBtn.classList.add('loading');
    
    try {
        const response = await fetch(`${API_URL}/api/send-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ channelId, message })
        });
        
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showNotification('✅ Mensaje enviado correctamente', 'success');
            messageInput.value = '';
        } else {
            showNotification(`❌ ${data.error || 'Error enviando mensaje'}`, 'error');
        }
    } catch (error) {
        showNotification('❌ Error de conexión al enviar mensaje', 'error');
        console.error(error);
    } finally {
        sendBtn.disabled = false;
        sendBtn.classList.remove('loading');
    }
}

async function logout() {
    try {
        await fetch(`${API_URL}/api/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Error logging out:', error);
        window.location.href = '/login.html';
    }
}

function showNotification(message, type) {
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        sendMessage();
    }
});

checkAuth();
loadChannels();