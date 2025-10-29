const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.SESSION_SECRET || 'discord-dashboard-secret-key-change-this';

const requireAuth = (req, res, next) => {
    const token = req.cookies.auth_token;
    
    if (!token) {
        return res.status(401).json({ 
            success: false,
            error: 'No autenticado. Por favor inicia sesión.' 
        });
    }

    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false,
            error: 'Token inválido o expirado.' 
        });
    }
};

async function waitForClient(client, maxWait = 15000) {
    const startTime = Date.now();
    
    while (!client.isReady()) {
        if (Date.now() - startTime > maxWait) {
            throw new Error('Timeout esperando la conexión del bot');
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return client;
}

module.exports = (client) => {
    const router = express.Router();

    router.get('/channels', requireAuth, async (req, res) => {
        try {
            await waitForClient(client);

            const guilds = client.guilds.cache;
            const channelsData = [];

            guilds.forEach(guild => {
                const channels = guild.channels.cache
                    .filter(channel => channel.isTextBased())
                    .map(channel => ({
                        id: channel.id,
                        name: channel.name,
                        guild: guild.name
                    }));
                channelsData.push(...channels);
            });

            res.json({ 
                success: true,
                channels: channelsData 
            });
        } catch (error) {
            console.error('Error obteniendo canales:', error);
            res.status(503).json({ 
                success: false,
                error: 'El bot aún se está conectando. Intenta de nuevo en unos segundos.'
            });
        }
    });

    router.post('/send-message', requireAuth, async (req, res) => {
        const { channelId, message } = req.body;

        if (!channelId || !message) {
            return res.status(400).json({ 
                success: false,
                error: 'Canal y mensaje son requeridos' 
            });
        }

        try {
            await waitForClient(client);

            const channel = await client.channels.fetch(channelId);
            
            if (!channel || !channel.isTextBased()) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Canal no encontrado o no es de texto' 
                });
            }

            await channel.send(message);
            res.json({ 
                success: true, 
                message: 'Mensaje enviado correctamente' 
            });
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error enviando mensaje: ' + error.message
            });
        }
    });

    router.get('/servers', requireAuth, async (req, res) => {
        try {
            await waitForClient(client);

            const guilds = client.guilds.cache;
            const serversData = [];

            guilds.forEach(guild => {
                serversData.push({
                    id: guild.id,
                    name: guild.name,
                    memberCount: guild.memberCount
                });
            });

            res.json({ 
                success: true,
                servers: serversData 
            });
        } catch (error) {
            console.error('Error obteniendo servidores:', error);
            res.status(503).json({ 
                success: false,
                error: 'El bot aún se está conectando.'
            });
        }
    });

    router.get('/stats/:guildId', requireAuth, async (req, res) => {
        const { guildId } = req.params;

        try {
            await waitForClient(client);

            const guild = client.guilds.cache.get(guildId);
            
            if (!guild) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Servidor no encontrado' 
                });
            }

            await guild.members.fetch();

            const roleStats = [];
            const roles = guild.roles.cache
                .filter(role => role.name !== '@everyone')
                .sort((a, b) => b.position - a.position);

            const roleIcons = {
                'admin': '👑',
                'moderator': '🛡️',
                'mod': '🛡️',
                'vip': '⭐',
                'premium': '💎',
                'member': '👤',
                'bot': '🤖',
                'verified': '✅',
                'developer': '💻',
                'designer': '🎨',
                'supporter': '❤️',
                'helper': '🆘',
                'default': '📌'
            };

            roles.forEach(role => {
                const count = role.members.size;
                if (count > 0) {
                    const roleName = role.name.toLowerCase();
                    let icon = roleIcons.default;
                    
                    for (const [key, value] of Object.entries(roleIcons)) {
                        if (roleName.includes(key)) {
                            icon = value;
                            break;
                        }
                    }

                    roleStats.push({
                        name: role.name,
                        count: count,
                        color: role.hexColor !== '#000000' ? role.hexColor : '#667eea',
                        icon: icon
                    });
                }
            });

            res.json({ 
                success: true,
                stats: {
                    totalMembers: guild.memberCount,
                    roles: roleStats
                }
            });
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error obteniendo estadísticas: ' + error.message
            });
        }
    });

    return router;
};