const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'discord-dashboard-secret-key-change-this';

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
                        guild: guild.name,
                        guildId: guild.id
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

    router.get('/roles/:guildId', requireAuth, async (req, res) => {
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

            const rolesData = guild.roles.cache
                .filter(role => role.name !== '@everyone')
                .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.hexColor,
                    position: role.position
                }))
                .sort((a, b) => b.position - a.position);

            res.json({ 
                success: true,
                roles: rolesData 
            });
        } catch (error) {
            console.error('Error obteniendo roles:', error);
            res.status(503).json({ 
                success: false,
                error: 'Error obteniendo roles'
            });
        }
    });

    router.get('/emojis/:guildId', requireAuth, async (req, res) => {
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

            const emojisData = guild.emojis.cache
                .map(emoji => ({
                    id: emoji.id,
                    name: emoji.name,
                    url: emoji.url,
                    animated: emoji.animated
                }));

            res.json({ 
                success: true,
                emojis: emojisData 
            });
        } catch (error) {
            console.error('Error obteniendo emojis:', error);
            res.status(503).json({ 
                success: false,
                error: 'Error obteniendo emojis'
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

            const onlineMembers = guild.members.cache.filter(
                member => member.presence?.status === 'online' || 
                        member.presence?.status === 'idle' || 
                        member.presence?.status === 'dnd'
            ).size;

            const textChannels = guild.channels.cache.filter(ch => ch.type === 0).size;
            const voiceChannels = guild.channels.cache.filter(ch => ch.type === 2).size;

            const roles = guild.roles.cache
                .filter(role => role.name !== '@everyone')
                .map(role => ({
                    id: role.id,
                    name: role.name,
                    memberCount: role.members.size
                }))
                .sort((a, b) => b.memberCount - a.memberCount);

            res.json({ 
                success: true,
                stats: {
                    memberCount: guild.memberCount,
                    onlineMembers: onlineMembers,
                    textChannels: textChannels,
                    voiceChannels: voiceChannels,
                    emojiCount: guild.emojis.cache.size,
                    roles: roles
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

    // Endpoint para calcular estudiantes expulsados en tiempo real
    router.get('/calculate-expelled/:guildId', requireAuth, async (req, res) => {
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

            // Buscar roles específicos
            const nslRole = guild.roles.cache.find(r => r.name === 'NSL');
            const estudianteOficialRole = guild.roles.cache.find(r => r.name === 'Estudiante Privado Oficial');

            if (!nslRole || !estudianteOficialRole) {
                return res.json({ 
                    success: true,
                    expelled: 0,
                    nslCount: nslRole ? nslRole.members.size : 0,
                    estudianteCount: estudianteOficialRole ? estudianteOficialRole.members.size : 0,
                    warning: 'No se encontraron todos los roles necesarios'
                });
            }

            const nslCount = nslRole.members.size;
            const estudianteCount = estudianteOficialRole.members.size;
            const expelled = nslCount - estudianteCount;

            res.json({ 
                success: true,
                expelled: expelled,
                nslCount: nslCount,
                estudianteCount: estudianteCount
            });
        } catch (error) {
            console.error('Error calculando expulsados:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error calculando expulsados: ' + error.message
            });
        }
    });

    return router;
};