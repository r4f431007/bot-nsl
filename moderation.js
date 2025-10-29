const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const { getPool } = require('./db');

const muteTimeouts = new Map();

async function setupModerationSystem(client) {
    
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        try {
            const pool = getPool();
            const result = await pool.query(
                'SELECT * FROM actions WHERE type = $1 AND enabled = true',
                ['moderation']
            );
            
            for (const action of result.rows) {
                const config = typeof action.config === 'string' 
                    ? JSON.parse(action.config) 
                    : action.config;
                
                const channels = config.moderationChannels || [];
                if (channels.length > 0 && !channels.includes(message.channel.id)) {
                    continue;
                }
                
                let shouldModerate = false;
                let reason = '';
                
                const modType = config.modType;
                
                if (modType === 'spam' || modType === 'flood') {
                    const messageLimit = parseInt(config.messageLimit) || 5;
                    const timeWindow = parseInt(config.timeWindow) || 5;
                    
                    const key = `${message.guild.id}-${message.author.id}`;
                    if (!client.messageCache) client.messageCache = new Map();
                    
                    if (!client.messageCache.has(key)) {
                        client.messageCache.set(key, []);
                    }
                    
                    const userMessages = client.messageCache.get(key);
                    userMessages.push(Date.now());
                    
                    const cutoff = Date.now() - (timeWindow * 1000);
                    const recentMessages = userMessages.filter(time => time > cutoff);
                    client.messageCache.set(key, recentMessages);
                    
                    if (recentMessages.length > messageLimit) {
                        shouldModerate = true;
                        reason = `Spam detectado: ${recentMessages.length} mensajes en ${timeWindow}s`;
                    }
                }
                
                if (modType === 'caps') {
                    const capsPercent = (message.content.match(/[A-Z]/g) || []).length / message.content.length;
                    if (message.content.length > 10 && capsPercent > 0.7) {
                        shouldModerate = true;
                        reason = 'Uso excesivo de mayúsculas';
                    }
                }
                
                if (modType === 'links') {
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    if (urlRegex.test(message.content)) {
                        shouldModerate = true;
                        reason = 'Link no permitido';
                    }
                }
                
                if (modType === 'badwords') {
                    const badwords = ['palabra1', 'palabra2'];
                    const content = message.content.toLowerCase();
                    if (badwords.some(word => content.includes(word))) {
                        shouldModerate = true;
                        reason = 'Palabra prohibida detectada';
                    }
                }
                
                if (shouldModerate) {
                    try {
                        await message.delete();
                    } catch (err) {
                        console.error('Error al eliminar mensaje:', err);
                    }
                    
                    const member = message.member;
                    const punishment = config.punishment || 'timeout';
                    const duration = parseInt(config.duration) || 60;
                    const moderationMessage = config.moderationMessage || reason;
                    
                    try {
                        if (punishment === 'timeout') {
                            await member.timeout(duration * 1000, reason);
                            
                            await message.channel.send(
                                `${message.author} has sido silenciado por ${duration}s. Razón: ${moderationMessage}`
                            );
                            
                        } else if (punishment === 'kick') {
                            await member.kick(reason);
                            
                            await message.channel.send(
                                `${message.author} ha sido expulsado. Razón: ${moderationMessage}`
                            );
                            
                        } else if (punishment === 'ban') {
                            await member.ban({ reason });
                            
                            await message.channel.send(
                                `${message.author} ha sido baneado. Razón: ${moderationMessage}`
                            );
                            
                        } else if (punishment === 'warn') {
                            await message.channel.send(
                                `⚠️ ${message.author} Advertencia: ${moderationMessage}`
                            );
                        }
                        
                    } catch (error) {
                        console.error('Error aplicando castigo:', error);
                        await message.channel.send(
                            `No pude aplicar el castigo a ${message.author}. Verifica mis permisos.`
                        );
                    }
                    
                    break;
                }
            }
            
        } catch (error) {
            console.error('Error en sistema de moderación:', error);
        }
    });
}

async function muteUser(client, guildId, userId, duration, reason) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return { success: false, error: 'Servidor no encontrado' };
        
        const member = await guild.members.fetch(userId);
        if (!member) return { success: false, error: 'Usuario no encontrado' };
        
        let muteRole = guild.roles.cache.find(role => role.name === 'Muted');
        
        if (!muteRole) {
            muteRole = await guild.roles.create({
                name: 'Muted',
                color: '#818386',
                permissions: []
            });
            
            guild.channels.cache.forEach(async (channel) => {
                await channel.permissionOverwrites.create(muteRole, {
                    SendMessages: false,
                    AddReactions: false,
                    Speak: false
                });
            });
        }
        
        await member.roles.add(muteRole, reason);
        
        const timeoutId = setTimeout(async () => {
            try {
                const currentMember = await guild.members.fetch(userId);
                if (currentMember && currentMember.roles.cache.has(muteRole.id)) {
                    await currentMember.roles.remove(muteRole, 'Tiempo de mute cumplido');
                    console.log(`Unmuted ${userId} después de ${duration}s`);
                }
            } catch (error) {
                console.error('Error al quitar mute automático:', error);
            }
            muteTimeouts.delete(`${guildId}-${userId}`);
        }, duration * 1000);
        
        muteTimeouts.set(`${guildId}-${userId}`, timeoutId);
        
        return { success: true };
        
    } catch (error) {
        console.error('Error al mutear usuario:', error);
        return { success: false, error: error.message };
    }
}

async function unmuteUser(client, guildId, userId) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return { success: false, error: 'Servidor no encontrado' };
        
        const member = await guild.members.fetch(userId);
        if (!member) return { success: false, error: 'Usuario no encontrado' };
        
        const muteRole = guild.roles.cache.find(role => role.name === 'Muted');
        if (muteRole && member.roles.cache.has(muteRole.id)) {
            await member.roles.remove(muteRole, 'Unmute manual');
        }
        
        const timeoutKey = `${guildId}-${userId}`;
        if (muteTimeouts.has(timeoutKey)) {
            clearTimeout(muteTimeouts.get(timeoutKey));
            muteTimeouts.delete(timeoutKey);
        }
        
        return { success: true };
        
    } catch (error) {
        console.error('Error al unmutear usuario:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { setupModerationSystem, muteUser, unmuteUser };