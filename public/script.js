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


function normalizeText(text) {
    return text.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function filterChannels(searchTerm) {
    const term = normalizeText(searchTerm.trim());
    
    if (!term) {
        return allChannels;
    }
    
    return allChannels.filter(channel => 
        normalizeText(channel.name).includes(term) ||
        normalizeText(channel.guild).includes(term)
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
        
        if (selectedChannel && selectedChannel.id === channel.id) {
            option.classList.add('selected');
        }
        
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

channelSearch.addEventListener('click', () => {
    const selectContainer = channelSearch.parentElement;
    selectContainer.classList.add('open');
    const filtered = filterChannels(channelSearch.value);
    renderDropdown(filtered);
});

let dropdownCloseTimeout;

channelSearch.addEventListener('blur', (e) => {
    const selectContainer = channelSearch.parentElement;
    dropdownCloseTimeout = setTimeout(() => {
        selectContainer.classList.remove('open');
        channelDropdown.classList.remove('show');
    }, 300);
});

channelDropdown.addEventListener('mousedown', (e) => {
    if (dropdownCloseTimeout) {
        clearTimeout(dropdownCloseTimeout);
    }
});

channelDropdown.addEventListener('mouseleave', () => {
    if (document.activeElement !== channelSearch) {
        const selectContainer = channelSearch.parentElement;
        dropdownCloseTimeout = setTimeout(() => {
            selectContainer.classList.remove('open');
            channelDropdown.classList.remove('show');
        }, 300);
    }
});

document.addEventListener('click', (e) => {
    const selectContainer = document.querySelector('.select-container');
    if (!channelSearch.contains(e.target) && !channelDropdown.contains(e.target)) {
        if (selectContainer) selectContainer.classList.remove('open');
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
            currentGuildId = allServers[0].id;
            loadStats(currentGuildId);
            await loadRoles(currentGuildId);
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

serverSelect.addEventListener('change', async (e) => {
    if (e.target.value) {
        currentGuildId = e.target.value;
        loadStats(currentGuildId);
        await loadRoles(currentGuildId);
    }
});

async function loadAllActions() {
    loadActions('moderation');
    loadActions('autoroles');
    loadActions('scheduled');
    loadActions('events');
    loadActions('alerts');
}

async function loadActions(type) {
    try {
        const response = await fetch(`${API_URL}/api/actions/${type}`, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.replace('/login.html');
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            renderActions(type, data.actions || []);
        }
    } catch (error) {
        console.error(`Error cargando acciones ${type}:`, error);
    }
}

function renderActions(type, actions) {
    const container = document.getElementById(`${type}Actions`);
    
    if (actions.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No hay acciones configuradas</p>';
        return;
    }
    
    container.innerHTML = '';
    
    actions.forEach(action => {
        const card = document.createElement('div');
        card.className = 'action-card';
        card.innerHTML = `
            <div class="action-info">
                <div class="action-title">${action.name}</div>
                <div class="action-description">${action.description}</div>
            </div>
            <div class="action-controls">
                <label class="toggle-switch">
                    <input type="checkbox" ${action.enabled ? 'checked' : ''} onchange="toggleAction('${type}', '${action.id}', this.checked)">
                    <span class="toggle-slider"></span>
                </label>
                <button class="btn-action btn-edit" onclick="editAction('${type}', '${action.id}')">Editar</button>
                <button class="btn-action btn-delete" onclick="deleteAction('${type}', '${action.id}')">Eliminar</button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function openActionModal(type) {
    currentActionType = type;
    
    if (!currentGuildId && allServers.length > 0) {
        currentGuildId = allServers[0].id;
        await loadRoles(currentGuildId);
    }
    
    await loadGuildEmojis();
    
    const modal = document.getElementById('actionModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    const titles = {
        moderation: '🛡️ Nueva Acción de Moderación',
        autoroles: '👥 Nueva Acción de Auto-Role',
        scheduled: '📅 Nueva Tarea Programada',
        events: '🎯 Nuevo Evento Automático',
        alerts: '🔔 Nueva Alerta'
    };
    
    modalTitle.textContent = titles[type];
    modalBody.innerHTML = await getModalForm(type);
    modal.classList.add('show');
}

function closeActionModal() {
    document.getElementById('actionModal').classList.remove('show');
}

function getRolesOptions() {
    const roles = allRoles[currentGuildId] || [];
    return roles.map(role => `<option value="${role.id}">${role.name}</option>`).join('');
}

function getChannelsOptions() {
    return allChannels.map(channel => `<option value="${channel.id}">${channel.guild} - #${channel.name}</option>`).join('');
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
                        <input type="checkbox" id="selectAllChannels" onchange="toggleAllChannels(this)" style="margin-right: 8px;">
                        <span style="font-weight: 600;">TODOS los canales</span>
                    </label>
                </div>
                <select id="moderationChannels" multiple style="height: 120px;">
                    ${getChannelsOptions()}
                </select>
                <small>Vacío = aplica a todos. Mantén Ctrl/Cmd para seleccionar múltiples</small>
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
                    <label>Días antes de expulsar</label>
                    <input type="number" id="kickDays" value="7" min="1">
                </div>
                <div class="form-group">
                    <label>Excluir roles (opcional)</label>
                    <select id="excludeRoles" multiple style="height: 100px;">
                        ${getRolesOptions()}
                    </select>
                    <small>Mantén Ctrl/Cmd para seleccionar múltiples</small>
                </div>
            </div>
            <button class="btn-save" onclick="saveAction('scheduled')">Guardar Tarea</button>
        `,
        events: `
            <div class="form-group">
                <label>Tipo de Evento</label>
                <select id="eventType">
                    <option value="giveaway">Sorteo (Giveaway)</option>
                    <option value="drop">Drop Aleatorio</option>
                    <option value="reward">Recompensa por Invites</option>
                </select>
                <small>
                    <strong>Sorteo:</strong> Sorteo programado con duración específica<br>
                    <strong>Drop:</strong> Recompensa aleatoria que aparece en el canal<br>
                    <strong>Invites:</strong> Da rol/premio automático al invitar X personas
                </small>
            </div>
            <div class="form-group">
                <label>Premio/Recompensa</label>
                <input type="text" id="prize" placeholder="Descripción del premio o rol">
            </div>
            <div class="form-group">
                <label>Canal</label>
                <select id="eventChannel">
                    ${getChannelsOptions()}
                </select>
            </div>
            <div class="form-group">
                <label>Duración (minutos)</label>
                <input type="number" id="eventDuration" value="60" min="1">
            </div>
            <div class="form-group">
                <label>Ganadores (solo para sorteos)</label>
                <input type="number" id="winnersCount" value="1" min="1">
            </div>
            <button class="btn-save" onclick="saveAction('events')">Guardar Evento</button>
        `,
        alerts: `
            <div class="form-group">
                <label>Tipo de Alerta</label>
                <select id="alertType">
                    <option value="keywords">Keywords (Palabras Clave)</option>
                    <option value="joins">Nuevos Miembros</option>
                    <option value="leaves">Salidas de Miembros</option>
                </select>
                <small>
                    <strong>Keywords:</strong> Notifica cuando alguien menciona palabras específicas (útil para detectar competencia, problemas, oportunidades)<br>
                    <strong>Nuevos Miembros:</strong> Alerta al staff cuando entra alguien nuevo<br>
                    <strong>Salidas:</strong> Notifica cuando alguien sale del servidor
                </small>
            </div>
            <div class="form-group">
                <label>Canal de notificación (para staff)</label>
                <select id="alertChannel">
                    ${getChannelsOptions()}
                </select>
            </div>
            <div class="form-group" id="keywordsGroup">
                <label>Keywords (separadas por comas)</label>
                <textarea id="keywords" rows="3" placeholder="competencia, problema, ayuda, bug, error, precio"></textarea>
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