const API_URL = window.location.origin;

const channelSearch = document.getElementById('channelSearch');
const channelDropdown = document.getElementById('channelDropdown');
const selectedChannelId = document.getElementById('selectedChannelId');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const notification = document.getElementById('notification');
const statsGrid = document.getElementById('statsGrid');
const serverSelect = document.getElementById('serverSelect');

let allChannels = [];
let selectedChannel = null;
let allServers = [];
let checkingAuth = false;

async function checkAuth() {
    if (checkingAuth) return;
    checkingAuth = true;
    
    try {
        const response = await fetch(`${API_URL}/api/check-auth`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.replace('/login.html');
        }
    } catch (error) {
        console.error('Error checking auth:', error);
        window.location.replace('/login.html');
    } finally {
        checkingAuth = false;
    }
}

document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        if (tabName === 'stats' && allServers.length === 0) {
            loadServers();
        }
    });
});

async function loadChannels() {
    try {
        const response = await fetch(`${API_URL}/api/channels`, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.replace('/login.html');
            return;
        }
        
        const data = await response.json();
        
        if (!data.success) {
            showNotification('❌ ' + (data.error || 'Error cargando canales'), 'error');
            return;
        }
        
        allChannels = data.channels;
        
        if (allChannels.length === 0) {
            channelSearch.placeholder = 'No hay canales disponibles';
            showNotification('⚠️ No se encontraron canales. Verifica que el bot esté en un servidor.', 'error');
            return;
        }
        
        channelSearch.placeholder = `Busca entre ${allChannels.length} canales...`;
    } catch (error) {
        showNotification('❌ Error de conexión al cargar canales', 'error');
        console.error(error);
    }
}

function filterChannels(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
        return allChannels;
    }
    
    return allChannels.filter(channel => 
        channel.name.toLowerCase().includes(term) ||
        channel.guild.toLowerCase().includes(term)
    );
}

function renderDropdown(channels) {
    channelDropdown.innerHTML = '';
    
    if (channels.length === 0) {
        channelDropdown.innerHTML = '<div class="no-results">No se encontraron canales</div>';
        channelDropdown.classList.add('show');
        return;
    }
    
    channels.forEach(channel => {
        const option = document.createElement('div');
        option.className = 'channel-option';
        option.dataset.channelId = channel.id;
        option.innerHTML = `
            <div class="guild-name">${channel.guild}</div>
            <div class="channel-name">#${channel.name}</div>
        `;
        
        option.addEventListener('click', () => selectChannel(channel, option));
        channelDropdown.appendChild(option);
    });
    
    channelDropdown.classList.add('show');
}

function selectChannel(channel, optionElement) {
    selectedChannel = channel;
    selectedChannelId.value = channel.id;
    channelSearch.value = `${channel.guild} - #${channel.name}`;
    
    document.querySelectorAll('.channel-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    if (optionElement) {
        optionElement.classList.add('selected');
    }
    
    channelDropdown.classList.remove('show');
}

channelSearch.addEventListener('input', (e) => {
    const searchTerm = e.target.value;
    const filtered = filterChannels(searchTerm);
    renderDropdown(filtered);
});

channelSearch.addEventListener('focus', () => {
    if (channelSearch.value && !selectedChannel) {
        const filtered = filterChannels(channelSearch.value);
        renderDropdown(filtered);
    } else if (!channelSearch.value) {
        renderDropdown(allChannels.slice(0, 20));
    }
});

channelSearch.addEventListener('blur', (e) => {
    setTimeout(() => {
        channelDropdown.classList.remove('show');
    }, 200);
});

document.addEventListener('click', (e) => {
    if (!channelSearch.contains(e.target) && !channelDropdown.contains(e.target)) {
        channelDropdown.classList.remove('show');
    }
});

async function sendMessage() {
    const channelId = selectedChannelId.value;
    const message = messageInput.value.trim();
    
    if (!channelId) {
        showNotification('⚠️ Por favor selecciona un canal', 'error');
        channelSearch.focus();
        return;
    }
    
    if (!message) {
        showNotification('⚠️ Por favor escribe un mensaje', 'error');
        messageInput.focus();
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
            window.location.replace('/login.html');
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

async function loadServers() {
    try {
        const response = await fetch(`${API_URL}/api/servers`, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.replace('/login.html');
            return;
        }
        
        const data = await response.json();
        
        if (!data.success) {
            console.error('Error cargando servidores:', data.error);
            return;
        }
        
        allServers = data.servers;
        
        serverSelect.innerHTML = '';
        
        if (allServers.length === 0) {
            serverSelect.innerHTML = '<option value="">No hay servidores</option>';
            return;
        }
        
        allServers.forEach(server => {
            const option = document.createElement('option');
            option.value = server.id;
            option.textContent = server.name;
            serverSelect.appendChild(option);
        });
        
        if (allServers.length > 0) {
            loadStats(allServers[0].id);
        }
    } catch (error) {
        console.error('Error cargando servidores:', error);
    }
}

async function loadStats(guildId) {
    statsGrid.innerHTML = '<div class="stat-card loading"><div class="stat-icon">⏳</div><div class="stat-info"><div class="stat-label">Cargando...</div><div class="stat-value">-</div></div></div>';
    
    try {
        const response = await fetch(`${API_URL}/api/stats/${guildId}`, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.replace('/login.html');
            return;
        }
        
        const data = await response.json();
        
        if (!data.success) {
            console.error('Error cargando stats:', data.error);
            return;
        }
        
        renderStats(data.stats);
    } catch (error) {
        console.error('Error cargando stats:', error);
    }
}

function renderStats(stats) {
    statsGrid.innerHTML = '';
    
    const totalCard = document.createElement('div');
    totalCard.className = 'stat-card';
    totalCard.innerHTML = `
        <div class="stat-icon">👥</div>
        <div class="stat-info">
            <div class="stat-label">Total Miembros</div>
            <div class="stat-value">${stats.totalMembers}</div>
        </div>
    `;
    statsGrid.appendChild(totalCard);
    
    stats.roles.forEach(role => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.style.background = `linear-gradient(135deg, ${role.color || '#667eea'} 0%, ${adjustColor(role.color || '#667eea', -20)} 100%)`;
        card.innerHTML = `
            <div class="stat-icon">${role.icon}</div>
            <div class="stat-info">
                <div class="stat-label">${role.name}</div>
                <div class="stat-value">${role.count}</div>
            </div>
        `;
        statsGrid.appendChild(card);
    });
}

function adjustColor(color, amount) {
    const clamp = (num) => Math.min(255, Math.max(0, num));
    const num = parseInt(color.replace('#', ''), 16);
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 0x00FF) + amount);
    const b = clamp((num & 0x0000FF) + amount);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

serverSelect.addEventListener('change', (e) => {
    if (e.target.value) {
        loadStats(e.target.value);
    }
});

async function logout() {
    try {
        await fetch(`${API_URL}/api/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        window.location.replace('/login.html');
    } catch (error) {
        console.error('Error logging out:', error);
        window.location.replace('/login.html');
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