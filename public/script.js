const API_URL = window.location.origin;

const channelSearch = document.getElementById('channelSearch');
const channelDropdown = document.getElementById('channelDropdown');
const selectedChannelId = document.getElementById('selectedChannelId');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const notification = document.getElementById('notification');
const statsGrid = document.getElementById('statsGrid');
const serverSelect = document.getElementById('serverSelect');
const actionModal = document.getElementById('actionModal');

let allChannels = [];
let selectedChannel = null;
let allServers = [];
let allRoles = {};
let checkingAuth = false;
let currentActionType = '';
let currentGuildId = '';
let selectedModalChannels = [];

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
        } else if (tabName === 'actions') {
            if (allServers.length === 0) {
                loadServers().then(() => loadAllActions());
            } else {
                loadAllActions();
            }
        }
    });
});

document.querySelectorAll('.sub-tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const subtabName = button.dataset.subtab;
        
        document.querySelectorAll('.sub-tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
        
        document.querySelectorAll('.sub-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${subtabName}-subtab`).classList.add('active');
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
            showNotification('⚠️ No se encontraron canales.', 'error');
            return;
        }
        
        channelSearch.placeholder = `Busca entre ${allChannels.length} canales...`;
    } catch (error) {
        showNotification('❌ Error de conexión al cargar canales', 'error');
        console.error(error);
    }
}

async function loadRoles(guildId) {
    try {
        const response = await fetch(`${API_URL}/api/roles/${guildId}`, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.replace('/login.html');
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            allRoles[guildId] = data.roles;
            return data.roles;
        }
    } catch (error) {
        console.error('Error cargando roles:', error);
    }
    return [];
}

function getChannelIcon(channelName) {
    const name = channelName.toLowerCase();
    
    if (name.includes('afk')) return '🛏️';
    if (name.includes('vip') || name.includes('recap')) return '📊';
    if (name.includes('sugerencia')) return '💡';
    if (name.includes('analiz')) return '🔍';
    if (name.includes('verifica')) return '✅';
    if (name.includes('regla')) return '📜';
    if (name.includes('bienvenida') || name.includes('welcome')) return '👋';
    if (name.includes('anuncio')) return '📢';
    if (name.includes('general') || name.includes('chat')) return '💬';
    if (name.includes('moderacion') || name.includes('mod')) return '🛡️';
    if (name.includes('log')) return '📝';
    if (name.includes('ticket')) return '🎫';
    if (name.includes('ayuda') || name.includes('help')) return '🆘';
    if (name.includes('musica') || name.includes('music')) return '🎵';
    if (name.includes('juego') || name.includes('game')) return '🎮';
    if (name.includes('meme')) return '😂';
    if (name.includes('arte') || name.includes('art')) return '🎨';
    if (name.includes('bot')) return '🤖';
    
    return '💬';
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
        
        if (selectedChannel && selectedChannel.id === channel.id) {
            option.classList.add('selected');
        }
        
        const icon = getChannelIcon(channel.name);
        
        option.innerHTML = `
            <span class="channel-icon">${icon}</span>
            <div class="channel-info">
                <div class="guild-name">${channel.guild}</div>
                <div class="channel-name">#${channel.name}</div>
            </div>
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
    
    const selectContainer = channelSearch.parentElement;
    selectContainer.classList.remove('open');
    channelDropdown.classList.remove('show');
}

channelSearch.addEventListener('input', (e) => {
    const searchTerm = e.target.value;
    const filtered = filterChannels(searchTerm);
    renderDropdown(filtered);
});

channelSearch.addEventListener('focus', () => {
    const selectContainer = channelSearch.parentElement;
    selectContainer.classList.add('open');
    const filtered = filterChannels(channelSearch.value);
    renderDropdown(filtered);
});

document.addEventListener('click', (e) => {
    const selectContainer = document.querySelector('.select-container');
    if (selectContainer && !selectContainer.contains(e.target)) {
        selectContainer.classList.remove('open');
        channelDropdown.classList.remove('show');
    }
});

function filterChannels(searchTerm) {
    const normalizedSearch = normalizeText(searchTerm);
    
    if (!normalizedSearch) {
        return allChannels;
    }
    
    return allChannels.filter(channel => {
        const normalizedGuild = normalizeText(channel.guild);
        const normalizedName = normalizeText(channel.name);
        return normalizedGuild.includes(normalizedSearch) || normalizedName.includes(normalizedSearch);
    });
}

function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

async function sendMessage() {
    if (!selectedChannel) {
        showNotification('⚠️ Por favor selecciona un canal', 'error');
        return;
    }
    
    const message = messageInput.value.trim();
    
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
            body: JSON.stringify({
                channelId: selectedChannel.id,
                message: message
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Mensaje enviado correctamente', 'success');
            messageInput.value = '';
        } else {
            showNotification('❌ ' + (data.error || 'Error al enviar el mensaje'), 'error');
        }
    } catch (error) {
        showNotification('❌ Error de conexión', 'error');
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
        
        if (data.success && data.servers && data.servers.length > 0) {
            allServers = data.servers;
            populateServerSelect();
        }
    } catch (error) {
        console.error('Error cargando servidores:', error);
    }
}

function populateServerSelect() {
    serverSelect.innerHTML = allServers.map(server => 
        `<option value="${server.id}">${server.name}</option>`
    ).join('');
    
    if (allServers.length > 0) {
        loadStats(allServers[0].id);
    }
}

serverSelect.addEventListener('change', (e) => {
    const serverId = e.target.value;
    if (serverId) {
        loadStats(serverId);
    }
});

async function loadStats(serverId) {
    statsGrid.innerHTML = '<div class="stat-card loading"><div class="stat-icon">⏳</div><div class="stat-info"><div class="stat-label">Cargando...</div><div class="stat-value">-</div></div></div>';
    
    try {
        const response = await fetch(`${API_URL}/api/stats/${serverId}`, {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            renderStats(data.stats);
        } else {
            statsGrid.innerHTML = '<div class="stat-card"><div class="stat-info"><div class="stat-label">Error al cargar estadísticas</div></div></div>';
        }
    } catch (error) {
        console.error('Error:', error);
        statsGrid.innerHTML = '<div class="stat-card"><div class="stat-info"><div class="stat-label">Error de conexión</div></div></div>';
    }
}

function renderStats(stats) {
    const statsArray = [
        { icon: '👥', label: 'Miembros Totales', value: stats.memberCount || 0 },
        { icon: '🟢', label: 'Miembros En Línea', value: stats.onlineMembers || 0 },
        { icon: '💬', label: 'Canales de Texto', value: stats.textChannels || 0 },
        { icon: '🔊', label: 'Canales de Voz', value: stats.voiceChannels || 0 },
        { icon: '😊', label: 'Emojis', value: stats.emojiCount || 0 }
    ];
    
    let html = statsArray.map(stat => `
        <div class="stat-card">
            <div class="stat-icon">${stat.icon}</div>
            <div class="stat-info">
                <div class="stat-label">${stat.label}</div>
                <div class="stat-value">${stat.value}</div>
            </div>
        </div>
    `).join('');
    
    if (stats.roles && stats.roles.length > 0) {
        const nslRole = stats.roles.find(r => r.name === 'NSL');
        const estudiantePrivadoRole = stats.roles.find(r => r.name === 'Estudiante Privado Oficial');
        
        if (nslRole && estudiantePrivadoRole) {
            const estudiantesExpulsados = Math.max(0, nslRole.memberCount - estudiantePrivadoRole.memberCount);
            
            html += `
                <div class="stat-card" style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); grid-column: span 2;">
                    <div class="stat-icon">⚠️</div>
                    <div class="stat-info">
                        <div class="stat-label">Estudiantes Expulsados</div>
                        <div class="stat-value">${estudiantesExpulsados}</div>
                    </div>
                </div>
            `;
        }
        
        stats.roles.forEach(role => {
            html += `
                <div class="stat-card">
                    <div class="stat-icon">👑</div>
                    <div class="stat-info">
                        <div class="stat-label">${role.name}</div>
                        <div class="stat-value">${role.memberCount || 0}</div>
                    </div>
                </div>
            `;
        });
    }
    
    statsGrid.innerHTML = html;
}

async function loadAllActions() {
    const types = ['moderation', 'autoroles', 'scheduled', 'events', 'alerts'];
    for (const type of types) {
        await loadActions(type);
    }
}

async function loadActions(type) {
    try {
        const response = await fetch(`${API_URL}/api/actions/${type}`, {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            renderActions(type, data.actions || []);
        }
    } catch (error) {
        console.error(`Error cargando ${type}:`, error);
    }
}

function renderActions(type, actions) {
    const container = document.getElementById(`${type}Actions`);
    
    if (!container) return;
    
    if (actions.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No hay acciones configuradas</p>';
        return;
    }
    
    container.innerHTML = actions.map(action => `
        <div class="action-card">
            <div class="action-info">
                <div class="action-title">${action.name || 'Acción sin nombre'}</div>
                <div class="action-description">${action.description || 'Sin descripción'}</div>
            </div>
            <div class="action-controls">
                <label class="toggle-switch">
                    <input type="checkbox" ${action.enabled ? 'checked' : ''} onchange="toggleAction('${type}', '${action.id}', this.checked)">
                    <span class="toggle-slider"></span>
                </label>
                <button class="btn-action btn-edit" onclick="editAction('${type}', '${action.id}')">Editar</button>
                <button class="btn-action btn-delete" onclick="deleteAction('${type}', '${action.id}')">Eliminar</button>
            </div>
        </div>
    `).join('');
}

function getChannelsOptions() {
    return allChannels.map(ch => 
        `<option value="${ch.id}">${ch.guild} - #${ch.name}</option>`
    ).join('');
}

function getRolesOptions() {
    if (!currentGuildId || !allRoles[currentGuildId]) {
        return '<option value="">Selecciona un servidor primero</option>';
    }
    
    return allRoles[currentGuildId].map(role => 
        `<option value="${role.id}">${role.name}</option>`
    ).join('');
}

async function openActionModal(type) {
    currentActionType = type;
    
    if (allServers.length === 0) {
        await loadServers();
    }
    
    if (allServers.length > 0 && !currentGuildId) {
        currentGuildId = allServers[0].id;
        await loadRoles(currentGuildId);
    }
    
    const modalTitle = {
        moderation: '🛡️ Nueva Acción de Moderación',
        autoroles: '👥 Nueva Acción de Auto-Roles',
        scheduled: '📅 Nueva Tarea Programada',
        events: '🎯 Nuevo Evento Automático',
        alerts: '🔔 Nueva Alerta'
    };
    
    document.getElementById('modalTitle').textContent = modalTitle[type] || 'Nueva Acción';
    document.getElementById('modalBody').innerHTML = await getModalForm(type);
    
    actionModal.classList.add('show');
    
    initializeModalDropdown();
}

function initializeModalDropdown() {
    const dropdown = document.querySelector('#moderationChannelsDropdown');
    if (!dropdown) return;
    
    const header = dropdown.querySelector('.modal-dropdown-header');
    const list = dropdown.querySelector('.modal-dropdown-list');
    const search = dropdown.querySelector('.modal-dropdown-search');
    const optionsContainer = dropdown.querySelector('.modal-dropdown-options');
    
    if (!header || !list || !search || !optionsContainer) return;
    
    selectedModalChannels = [];
    
    renderModalDropdownOptions(allChannels, optionsContainer);
    
    header.addEventListener('click', () => {
        list.classList.toggle('show');
        if (list.classList.contains('show')) {
            search.focus();
        }
    });
    
    search.addEventListener('input', (e) => {
        const filtered = filterChannels(e.target.value);
        renderModalDropdownOptions(filtered, optionsContainer);
    });
    
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            list.classList.remove('show');
        }
    });
}

function renderModalDropdownOptions(channels, container) {
    if (channels.length === 0) {
        container.innerHTML = '<div class="dropdown-option" style="text-align: center; color: #999;">No se encontraron canales</div>';
        return;
    }
    
    container.innerHTML = '';
    
    channels.forEach(channel => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.dataset.channelId = channel.id;
        
        if (selectedModalChannels.includes(channel.id)) {
            option.classList.add('selected');
        }
        
        const icon = getChannelIcon(channel.name);
        
        option.innerHTML = `
            <span class="channel-icon">${icon}</span>
            <div class="channel-info">
                <div class="guild-name">${channel.guild}</div>
                <div class="channel-name">#${channel.name}</div>
            </div>
        `;
        
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleModalChannel(channel.id, option);
        });
        
        container.appendChild(option);
    });
}

function toggleModalChannel(channelId, optionElement) {
    const index = selectedModalChannels.indexOf(channelId);
    
    if (index > -1) {
        selectedModalChannels.splice(index, 1);
        optionElement.classList.remove('selected');
    } else {
        selectedModalChannels.push(channelId);
        optionElement.classList.add('selected');
    }
    
    updateModalDropdownText();
    updateHiddenInput();
}

function updateModalDropdownText() {
    const textElement = document.querySelector('#moderationChannelsDropdown .modal-dropdown-text');
    if (!textElement) return;
    
    if (selectedModalChannels.length === 0) {
        textElement.textContent = 'Selecciona canales...';
    } else if (selectedModalChannels.length === 1) {
        const channel = allChannels.find(ch => ch.id === selectedModalChannels[0]);
        textElement.textContent = channel ? `${channel.guild} - #${channel.name}` : '1 canal seleccionado';
    } else {
        textElement.textContent = `${selectedModalChannels.length} canales seleccionados`;
    }
}

function updateHiddenInput() {
    const hiddenInput = document.getElementById('moderationChannels');
    if (hiddenInput) {
        hiddenInput.value = selectedModalChannels.join(',');
    }
}

function toggleAllChannelsDropdown(checkbox, dropdownId) {
    if (checkbox.checked) {
        selectedModalChannels = allChannels.map(ch => ch.id);
        
        document.querySelectorAll(`#${dropdownId} .dropdown-option`).forEach(opt => {
            opt.classList.add('selected');
        });
        
        updateModalDropdownText();
        updateHiddenInput();
    } else {
        selectedModalChannels = [];
        
        document.querySelectorAll(`#${dropdownId} .dropdown-option`).forEach(opt => {
            opt.classList.remove('selected');
        });
        
        updateModalDropdownText();
        updateHiddenInput();
    }
}

function closeActionModal() {
    actionModal.classList.remove('show');
    selectedModalChannels = [];
}

async function getModalForm(type) {
    const forms = {
        moderation: `
            <div class="form-group">
                <label>Tipo de Moderación</label>
                <select id="modType">
                    <option value="spam">Anti-Spam</option>
                    <option value="flood">Anti-Flood</option>
                    <option value="caps">Anti-Caps</option>
                    <option value="links">Anti-Links</option>
                    <option value="badwords">Palabras Prohibidas</option>
                </select>
            </div>
            <div class="form-group">
                <label>Canales (opcional)</label>
                <div style="margin-bottom: 10px;">
                    <label style="display: inline-flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="selectAllChannels" onchange="toggleAllChannelsDropdown(this, 'moderationChannelsDropdown')" style="margin-right: 8px;">
                        <span style="font-weight: 600;">TODOS los canales</span>
                    </label>
                </div>
                <div class="modal-custom-dropdown" id="moderationChannelsDropdown">
                    <div class="modal-dropdown-header" tabindex="0">
                        <span class="modal-dropdown-text">Selecciona canales...</span>
                        <span class="modal-dropdown-arrow">▼</span>
                    </div>
                    <div class="modal-dropdown-list">
                        <input type="text" class="modal-dropdown-search" placeholder="Buscar canales..." autocomplete="off" />
                        <div class="modal-dropdown-options"></div>
                    </div>
                </div>
                <input type="hidden" id="moderationChannels" />
                <small>Vacío = aplica a todos. Click para seleccionar múltiples</small>
            </div>
            <div class="form-group">
                <label>Mensajes permitidos</label>
                <input type="number" id="messageLimit" value="5" min="1">
            </div>
            <div class="form-group">
                <label>Tiempo (segundos)</label>
                <input type="number" id="timeWindow" value="5" min="1">
            </div>
            <div class="form-group">
                <label>Acción</label>
                <select id="punishment">
                    <option value="timeout">Timeout</option>
                    <option value="kick">Kick</option>
                    <option value="ban">Ban</option>
                    <option value="warn">Advertencia</option>
                </select>
            </div>
            <div class="form-group">
                <label>Duración del castigo (segundos)</label>
                <input type="number" id="duration" value="60" min="1">
            </div>
            <div class="form-group">
                <label>Mensaje de moderación</label>
                <textarea id="moderationMessage" rows="3" placeholder="Razón del castigo que verá el usuario (ej: Spam detectado)"></textarea>
            </div>
            <button class="btn-save" onclick="saveAction('moderation')">Guardar Acción</button>
        `,
        autoroles: `
            <div class="form-group">
                <label>Tipo de Auto-Role</label>
                <select id="autoRoleType">
                    <option value="time">Por tiempo en servidor</option>
                    <option value="activity">Por actividad</option>
                    <option value="verification">Verificación</option>
                </select>
            </div>
            <div class="form-group">
                <label>Rol a asignar</label>
                <select id="roleId">
                    ${getRolesOptions()}
                </select>
            </div>
            <div class="form-group">
                <label>Canales a monitorear (para actividad)</label>
                <div style="margin-bottom: 10px;">
                    <label style="display: inline-flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="selectAllChannelsAutoRole" onchange="toggleAllChannels(this, 'autoRoleChannels')" style="margin-right: 8px;">
                        <span style="font-weight: 600;">TODOS los canales</span>
                    </label>
                </div>
                <select id="autoRoleChannels" multiple style="height: 120px;">
                    ${getChannelsOptions()}
                </select>
                <small>Mantén Ctrl/Cmd para seleccionar múltiples</small>
            </div>
            <div class="form-group">
                <label>Días requeridos</label>
                <input type="number" id="daysRequired" value="7" min="1">
            </div>
            <div class="form-group">
                <label>Mensajes requeridos (solo para actividad)</label>
                <input type="number" id="messagesRequired" value="50" min="0">
            </div>
            <div class="form-group">
                <label>Comentario/Nota (opcional)</label>
                <textarea id="autoRoleComment" rows="2" placeholder="Nota interna sobre esta regla"></textarea>
            </div>
            <button class="btn-save" onclick="saveAction('autoroles')">Guardar Acción</button>
        `,
        scheduled: `
            <div class="form-group">
                <label>Tipo de Tarea</label>
                <select id="taskType" onchange="toggleKickRoleOptions()">
                    <option value="reminder">Recordatorio</option>
                    <option value="expulsion-warning">Recordatorio de Expulsión</option>
                    <option value="cleanup">Limpiar canal</option>
                    <option value="backup">Backup de roles</option>
                    <option value="kickRoles">Expulsar usuarios por roles</option>
                </select>
            </div>
            <div class="form-group">
                <label>Frecuencia</label>
                <select id="frequency">
                    <option value="once">Una vez</option>
                    <option value="daily">Diaria</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                </select>
            </div>
            <div class="form-group">
                <label>Fecha/Hora (tu zona horaria local)</label>
                <input type="datetime-local" id="scheduleTime">
            </div>
            <div class="form-group">
                <label>Canal</label>
                <select id="channelId">
                    <option value="">Ninguno</option>
                    ${getChannelsOptions()}
                </select>
            </div>
            <div class="form-group">
                <label>Mensaje/Descripción</label>
                <div style="display: flex; gap: 10px; margin-bottom: 8px;">
                    <button type="button" class="btn-emoji" onclick="openEmojiPicker()" style="padding: 8px 15px; background: #f0f0f0; border: 2px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 1.2rem;">😀 Emojis</button>
                    <button type="button" onclick="useExpulsionTemplate()" style="padding: 8px 15px; background: #dc3545; color: white; border: 2px solid #c82333; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600;">⚠️ Plantilla Expulsión</button>
                </div>
                <textarea id="taskMessage" rows="4" placeholder="Contenido del mensaje o descripción de la tarea"></textarea>
                <div id="emojiPicker" style="display: none; margin-top: 10px; padding: 15px; background: #f8f9fa; border-radius: 8px; max-height: 200px; overflow-y: auto;"></div>
            </div>
            <div id="roleKickOptions" style="display: none;">
                <div class="form-group">
                    <label>Rol a expulsar</label>
                    <select id="kickRoleId">
                        ${getRolesOptions()}
                    </select>
                </div>
                <div class="form-group">
                    <label>Días de inactividad</label>
                    <input type="number" id="inactiveDays" value="30" min="1">
                    <small>Expulsar usuarios con este rol si no han estado activos por X días</small>
                </div>
            </div>
            <button class="btn-save" onclick="saveAction('scheduled')">Guardar Tarea</button>
        `,
        events: `
            <div class="form-group">
                <label>Tipo de Evento</label>
                <select id="eventType">
                    <option value="memberJoin">Nuevo miembro</option>
                    <option value="memberLeave">Miembro abandona</option>
                    <option value="roleAdded">Rol añadido</option>
                    <option value="milestone">Milestone (usuarios)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Canal de notificación</label>
                <select id="notifyChannel">
                    ${getChannelsOptions()}
                </select>
            </div>
            <div class="form-group">
                <label>Mensaje personalizado</label>
                <textarea id="eventMessage" rows="4" placeholder="Usa {user}, {count}, {role} como variables"></textarea>
                <small>Ejemplo: "¡Bienvenido {user}! Eres el miembro #{count}"</small>
            </div>
            <div class="form-group">
                <label>Rol automático (para nuevos miembros)</label>
                <select id="autoRole">
                    <option value="">Ninguno</option>
                    ${getRolesOptions()}
                </select>
            </div>
            <button class="btn-save" onclick="saveAction('events')">Guardar Evento</button>
        `,
        alerts: `
            <div class="form-group">
                <label>Tipo de Alerta</label>
                <select id="alertType">
                    <option value="keyword">Palabra clave</option>
                    <option value="mentions">Menciones múltiples</option>
                    <option value="raids">Posible raid</option>
                    <option value="suspicious">Actividad sospechosa</option>
                </select>
            </div>
            <div class="form-group">
                <label>Canal de alertas</label>
                <select id="alertChannel">
                    ${getChannelsOptions()}
                </select>
            </div>
            <div class="form-group">
                <label>Palabras clave (separadas por comas)</label>
                <input type="text" id="keywords" placeholder="admin, help, urgente">
                <small>El bot monitoreará todos los mensajes y alertará cuando detecte estas palabras</small>
            </div>
            <button class="btn-save" onclick="saveAction('alerts')">Guardar Alerta</button>
        `
    };
    
    return forms[type] || '<p>Formulario no disponible</p>';
}

function toggleKickRoleOptions() {
    const taskType = document.getElementById('taskType').value;
    const kickOptions = document.getElementById('roleKickOptions');
    if (kickOptions) {
        kickOptions.style.display = taskType === 'kickRoles' ? 'block' : 'none';
    }
}

async function saveAction(type) {
    const actionData = getFormData(type);
    
    try {
        const response = await fetch(`${API_URL}/api/actions/${type}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(actionData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeActionModal();
            loadActions(type);
            showNotification('✅ Acción creada correctamente', 'success');
        } else {
            showNotification(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        showNotification('❌ Error al guardar acción', 'error');
        console.error(error);
    }
}

function getFormData(type) {
    const data = { 
        type, 
        guildId: currentGuildId || (allServers.length > 0 ? allServers[0].id : '1177852483981283378')
    };
    
    const formElements = document.querySelectorAll('#modalBody input, #modalBody select, #modalBody textarea');
    formElements.forEach(element => {
        if (element.id) {
            if (element.type === 'checkbox') {
                data[element.id] = element.checked;
            } else if (element.multiple) {
                data[element.id] = Array.from(element.selectedOptions).map(opt => opt.value);
            } else if (element.id === 'moderationChannels') {
                data[element.id] = element.value ? element.value.split(',') : [];
            } else {
                data[element.id] = element.value;
            }
        }
    });
    
    return data;
}

async function toggleAction(type, actionId, enabled) {
    try {
        const response = await fetch(`${API_URL}/api/actions/${type}/${actionId}/toggle`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ enabled })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`✅ Acción ${enabled ? 'activada' : 'desactivada'}`, 'success');
        }
    } catch (error) {
        console.error(error);
    }
}

async function editAction(type, actionId) {
    showNotification('⚠️ Función de edición en desarrollo', 'error');
}

async function deleteAction(type, actionId) {
    if (!confirm('¿Estás seguro de eliminar esta acción?')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/actions/${type}/${actionId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadActions(type);
            showNotification('✅ Acción eliminada', 'success');
        }
    } catch (error) {
        console.error(error);
    }
}

function toggleAllChannels(checkbox, selectId = 'moderationChannels') {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    if (checkbox.checked) {
        for (let i = 0; i < select.options.length; i++) {
            select.options[i].selected = true;
        }
    } else {
        for (let i = 0; i < select.options.length; i++) {
            select.options[i].selected = false;
        }
    }
}

let guildEmojis = [];

async function loadGuildEmojis() {
    if (!currentGuildId) return;
    
    try {
        const response = await fetch(`${API_URL}/api/emojis/${currentGuildId}`, {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            guildEmojis = data.emojis;
        }
    } catch (error) {
        console.error('Error cargando emojis:', error);
    }
}

function openEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    const textarea = document.getElementById('taskMessage');
    
    if (!picker || !textarea) return;
    
    if (picker.style.display === 'none') {
        picker.style.display = 'block';
        
        const defaultEmojis = ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥳', '🤩', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸'];
        
        picker.innerHTML = '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
        
        defaultEmojis.forEach(emoji => {
            picker.innerHTML += `<span style="font-size: 1.5rem; cursor: pointer; padding: 4px; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'" onclick="insertEmoji('${emoji}')">${emoji}</span>`;
        });
        
        if (guildEmojis.length > 0) {
            picker.innerHTML += '</div><hr style="margin: 15px 0;"><div style="font-weight: 600; margin-bottom: 10px;">Emojis del servidor:</div><div style="display: flex; flex-wrap: wrap; gap: 8px;">';
            
            guildEmojis.forEach(emoji => {
                picker.innerHTML += `<img src="${emoji.url}" alt="${emoji.name}" title=":${emoji.name}:" style="width: 32px; height: 32px; cursor: pointer; border-radius: 4px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" onclick="insertEmoji('<:${emoji.name}:${emoji.id}>')">`;
            });
        }
        
        picker.innerHTML += '</div>';
    } else {
        picker.style.display = 'none';
    }
}

function insertEmoji(emoji) {
    const textarea = document.getElementById('taskMessage');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    textarea.value = text.substring(0, start) + emoji + text.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    textarea.focus();
}

function useExpulsionTemplate() {
    const textarea = document.getElementById('taskMessage');
    if (!textarea) return;
    
    const template = `⚠️ **RECORDATORIO IMPORTANTE** ⚠️

Recuerda, los estudiantes marcados como "Estudiantes Expulsados" serán expulsados el **30 de Noviembre 2025**.

🔗 Haz tu onboarding aquí: http://onboarding.nosoyliquidez.com

No pierdas tu lugar en la comunidad NSL. ¡Completa el proceso ahora!`;
    
    textarea.value = template;
    textarea.focus();
}

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

document.getElementById('actionModal').addEventListener('click', (e) => {
    if (e.target === actionModal) {
        closeActionModal();
    }
});

checkAuth();
loadChannels();