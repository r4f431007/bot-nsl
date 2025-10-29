const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.login(process.env.DISCORD_TOKEN);

client.once('ready', () => {
    console.log(`Bot conectado como ${client.user.tag}`);
});

app.get('/api/channels', async (req, res) => {
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

        res.json({ channels: channelsData });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo canales' });
    }
});

app.post('/api/send-message', async (req, res) => {
    const { channelId, message } = req.body;

    if (!channelId || !message) {
        return res.status(400).json({ error: 'Canal y mensaje son requeridos' });
    }

    try {
        const channel = await client.channels.fetch(channelId);
        
        if (!channel || !channel.isTextBased()) {
            return res.status(404).json({ error: 'Canal no encontrado' });
        }

        await channel.send(message);
        res.json({ success: true, message: 'Mensaje enviado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error enviando mensaje' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});