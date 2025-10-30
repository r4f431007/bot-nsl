// server.js - Archivo principal del servidor
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { initDatabase } = require('./db');
const { setClient, initScheduler } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Crear cliente de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildEmojisAndStickers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Configurar el cliente en el scheduler
setClient(client);

// Evento cuando el bot está listo
client.once('ready', async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    console.log(`📊 Servidores: ${client.guilds.cache.size}`);
    
    // Iniciar el sistema de tareas programadas
    await initScheduler();
});

// Login del bot
client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('❌ Error al conectar el bot:', err);
    process.exit(1);
});

// Importar rutas
const authRoutes = require('./routes/auth');
const discordRoutes = require('./routes/discord')(client);
const actionsRoutes = require('./routes/actions')();

// Usar rutas
app.use('/api', authRoutes);
app.use('/api', discordRoutes);
app.use('/api', actionsRoutes);

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicializar base de datos y servidor
async function start() {
    try {
        await initDatabase();
        console.log('✅ Base de datos inicializada');
        
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
            console.log(`📋 Dashboard disponible en http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
}

start();

// Manejo de errores del proceso
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('SIGINT', () => {
    console.log('👋 Cerrando servidor...');
    client.destroy();
    process.exit(0);
});