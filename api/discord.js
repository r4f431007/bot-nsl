const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const router = express.Router();

let discordClient = null;
let clientReady = false;

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

async function getDiscordClient() {
    if (discordClient && clientReady) {
        return discordClient;
    }

    if (!discordClient) {
        discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers
            ]
        });

        discordClient.once('ready', () => {
            console.log(`Bot conectado como ${discordClient.user.tag}`);
            clientReady = true;
        });

        discordClient.on('error', (error) => {
            console.error('Error del cliente de Discord:', error);
            clientReady = false;
        });

        await discordClient.login(process.env.DISCORD_TOKEN);
        
        await new Promise((resolve) => {
            const checkReady = setInterval(() => {
                if (clientReady) {
                    clearInterval(checkReady);
                    resolve();
                }
            }, 100);
            
            setTimeout(() => {
                clearInterval(checkReady);
                resolve();
            }, 10000);
        });
    }

    return discordClient;
}

router.get('/channels', requireAuth, async (req, res) => {
    try {
        const client = await getDiscordClient();
        
        if (!clientReady) {
            return res.status(503).json({ 
                success: false,
                error: 'El bot aún se está conectando. Intenta de nuevo en unos segundos.' 
            });
        }

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
            error: 'Error obteniendo canales: ' + error.message
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
        const client = await getDiscordClient();
        
        if (!clientReady) {
            return res.status(503).json({ 
                success: false,
                error: 'El bot aún se está conectando. Intenta de nuevo en unos segundos.' 
            });
        }

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
        const client = await getDiscordClient();
        
        if (!clientReady) {
            return res.status(503).json({ 
                success: false,
                error: 'El bot aún se está conectando.' 
            });
        }

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
        res.status(500).json({ 
            success: false,
            error: 'Error obteniendo servidores: ' + error.message
        });
    }
});

router.get('/stats/:guildId', requireAuth, async (req, res) => {
    const { guildId } = req.params;

    try {
        const client = await getDiscordClient();
        
        if (!clientReady) {
            return res.status(503).json({ 
                success: false,
                error: 'El bot aún se está conectando.' 
            });
        }

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

module.exports = router;