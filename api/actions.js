const express = require('express');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'discord-dashboard-secret-key-change-this';

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

module.exports = () => {
    const router = express.Router();

    router.get('/actions/:type', requireAuth, async (req, res) => {
        const { type } = req.params;
        
        try {
            const pool = getPool();
            const result = await pool.query(
                'SELECT * FROM actions WHERE type = $1 ORDER BY created_at DESC',
                [type]
            );
            
            const actions = result.rows.map(row => {
                let config = {};
                try {
                    config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
                } catch (e) {
                    console.error('Error parsing config for action:', row.id, e);
                    config = {};
                }
                
                return {
                    id: row.id,
                    type: row.type,
                    name: row.name,
                    description: row.description,
                    enabled: Boolean(row.enabled),
                    createdAt: row.created_at,
                    ...config
                };
            });
            
            res.json({ 
                success: true,
                actions: actions
            });
        } catch (error) {
            console.error('Error obteniendo acciones:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error obteniendo acciones: ' + error.message
            });
        }
    });

    router.post('/actions/:type', requireAuth, async (req, res) => {
        const { type } = req.params;
        let actionData = req.body;
        
        try {
            const cleanData = JSON.parse(JSON.stringify(actionData));
            
            const newAction = {
                id: Date.now().toString(),
                type: type,
                name: generateActionName(type, cleanData),
                description: generateActionDescription(type, cleanData),
                enabled: true,
                createdAt: new Date().toISOString()
            };
            
            const pool = getPool();
            await pool.query(
                'INSERT INTO actions (id, type, name, description, config, enabled) VALUES ($1, $2, $3, $4, $5, $6)',
                [
                    newAction.id,
                    newAction.type,
                    newAction.name,
                    newAction.description,
                    JSON.stringify(cleanData),
                    newAction.enabled
                ]
            );
            
            res.json({ 
                success: true,
                action: { ...newAction, ...cleanData }
            });
        } catch (error) {
            console.error('Error creando acción:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error creando acción: ' + error.message
            });
        }
    });

    router.put('/actions/:type/:id/toggle', requireAuth, async (req, res) => {
        const { type, id } = req.params;
        const { enabled } = req.body;
        
        try {
            const pool = getPool();
            const result = await pool.query(
                'UPDATE actions SET enabled = $1 WHERE id = $2 AND type = $3',
                [enabled, id, type]
            );
            
            if (result.rowCount === 0) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Acción no encontrada'
                });
            }
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error actualizando acción:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error actualizando acción: ' + error.message
            });
        }
    });

    router.delete('/actions/:type/:id', requireAuth, async (req, res) => {
        const { type, id } = req.params;
        
        try {
            const pool = getPool();
            await pool.query(
                'DELETE FROM actions WHERE id = $1 AND type = $2',
                [id, type]
            );
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error eliminando acción:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error eliminando acción: ' + error.message
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