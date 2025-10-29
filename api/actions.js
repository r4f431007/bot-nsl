const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

const JWT_SECRET = process.env.SESSION_SECRET || 'discord-dashboard-secret-key-change-this';
const ACTIONS_FILE = path.join(__dirname, '../data/actions.json');

const requireAuth = (req, res, next) => {
    const token = req.cookies.auth_token;
    
    if (!token) {
        return res.status(401).json({ 
            success: false,
            error: 'No autenticado.' 
        });
    }

    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false,
            error: 'Token inválido.' 
        });
    }
};

async function ensureActionsFile() {
    try {
        await fs.access(ACTIONS_FILE);
    } catch {
        const dataDir = path.dirname(ACTIONS_FILE);
        try {
            await fs.mkdir(dataDir, { recursive: true });
        } catch (err) {
            console.error('Error creating data directory:', err);
        }
        await fs.writeFile(ACTIONS_FILE, JSON.stringify({
            moderation: [],
            autoroles: [],
            scheduled: [],
            events: [],
            alerts: []
        }));
    }
}

async function getActions() {
    await ensureActionsFile();
    const data = await fs.readFile(ACTIONS_FILE, 'utf8');
    return JSON.parse(data);
}

async function saveActions(actions) {
    await fs.writeFile(ACTIONS_FILE, JSON.stringify(actions, null, 2));
}

module.exports = () => {
    const router = express.Router();

    router.get('/actions/:type', requireAuth, async (req, res) => {
        const { type } = req.params;
        
        try {
            const actions = await getActions();
            res.json({ 
                success: true,
                actions: actions[type] || []
            });
        } catch (error) {
            console.error('Error obteniendo acciones:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error obteniendo acciones'
            });
        }
    });

    router.post('/actions/:type', requireAuth, async (req, res) => {
        const { type } = req.params;
        const actionData = req.body;
        
        try {
            const actions = await getActions();
            
            const newAction = {
                id: Date.now().toString(),
                ...actionData,
                name: generateActionName(type, actionData),
                description: generateActionDescription(type, actionData),
                enabled: true,
                createdAt: new Date().toISOString()
            };
            
            if (!actions[type]) {
                actions[type] = [];
            }
            
            actions[type].push(newAction);
            await saveActions(actions);
            
            res.json({ 
                success: true,
                action: newAction
            });
        } catch (error) {
            console.error('Error creando acción:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error creando acción'
            });
        }
    });

    router.put('/actions/:type/:id/toggle', requireAuth, async (req, res) => {
        const { type, id } = req.params;
        const { enabled } = req.body;
        
        try {
            const actions = await getActions();
            const action = actions[type].find(a => a.id === id);
            
            if (!action) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Acción no encontrada'
                });
            }
            
            action.enabled = enabled;
            await saveActions(actions);
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error actualizando acción:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error actualizando acción'
            });
        }
    });

    router.delete('/actions/:type/:id', requireAuth, async (req, res) => {
        const { type, id } = req.params;
        
        try {
            const actions = await getActions();
            actions[type] = actions[type].filter(a => a.id !== id);
            await saveActions(actions);
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error eliminando acción:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error eliminando acción'
            });
        }
    });

    return router;
};

function generateActionName(type, data) {
    const names = {
        moderation: `${data.modType || 'Moderación'} - ${data.messageLimit || '5'} msg/${data.timeWindow || '5'}s`,
        autoroles: `Auto-Role: ${data.autoRoleType || 'tiempo'} - ${data.daysRequired || '7'} días`,
        scheduled: `${data.taskType || 'Tarea'} - ${data.frequency || 'una vez'}`,
        events: `${data.eventType || 'Evento'} - ${data.prize || 'Premio'}`,
        alerts: `Alerta: ${data.alertType || 'general'}`
    };
    
    return names[type] || 'Acción';
}

function generateActionDescription(type, data) {
    const descriptions = {
        moderation: `Castigo: ${data.punishment || 'timeout'} por ${data.duration || '60'}s`,
        autoroles: `Asignar rol ${data.roleId || 'N/A'} después de ${data.daysRequired || '7'} días`,
        scheduled: `Ejecutar ${data.taskType || 'tarea'} ${data.frequency || 'una vez'}`,
        events: `Evento de ${data.prize || 'premio'} en canal ${data.eventChannel || 'N/A'}`,
        alerts: `Notificar en canal ${data.alertChannel || 'N/A'}`
    };
    
    return descriptions[type] || 'Sin descripción';
}