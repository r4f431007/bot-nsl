const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'discord-dashboard-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

const requireAuth = (req, res, next) => {
    if (req.session.authenticated) {
        next();
    } else {
        res.status(401).json({ error: 'No autenticado' });
    }
};

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

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        req.session.authenticated = true;
        req.session.user = email;
        res.json({ success: true, message: 'Login exitoso' });
    } else {
        res.status(401).json({ error: 'Credenciales incorrectas' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logout exitoso' });
});

app.get('/api/check-auth', (req, res) => {
    res.json({ authenticated: !!req.session.authenticated });
});

app.get('/api/channels', requireAuth, async (req, res) => {
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

app.post('/api/send-message', requireAuth, async (req, res) => {
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