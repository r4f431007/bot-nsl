const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();
// Después de tus imports existentes, agrega:
const { setClient, initScheduler } = require('./scheduler');

const authRoutes = require('./api/auth');
const discordRoutes = require('./api/discord');
const actionsRoutes = require('./api/actions');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let client = null;
let clientInitialized = false;

function initializeClient() {
    if (clientInitialized) return client;
    
    client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers
        ]
    });

    client.once('ready', () => {
        console.log(`Bot conectado como ${client.user.tag}`);
    });

    client.on('error', (error) => {
        console.error('Error del cliente de Discord:', error);
    });

    client.login(process.env.DISCORD_TOKEN).catch(err => {
        console.error('Error conectando el bot:', err);
    });

    clientInitialized = true;
    return client;
}

const discordClient = initializeClient();

app.use('/api', authRoutes);
app.use('/api', discordRoutes(discordClient));
app.use('/api', actionsRoutes());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
}

module.exports = app;