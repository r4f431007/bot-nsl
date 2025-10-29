const express = require('express');
const router = express.Router();

const requireAuth = (req, res, next) => {
    if (req.session.authenticated) {
        next();
    } else {
        res.status(401).json({ 
            success: false,
            error: 'No autenticado. Por favor inicia sesión.' 
        });
    }
};

function setupDiscordRoutes(client) {
    router.get('/channels', requireAuth, async (req, res) => {
        try {
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
            res.status(500).json({ 
                success: false,
                error: 'Error obteniendo canales' 
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
                error: 'Error enviando mensaje. Verifica que el bot tenga permisos.' 
            });
        }
    });

    return router;
}

module.exports = setupDiscordRoutes;