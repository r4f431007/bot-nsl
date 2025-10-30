const cron = require('node-cron');
const { getPool } = require('./db');

let client = null;
const activeTimeouts = new Map();

function setClient(discordClient) {
    client = discordClient;
    console.log('✅ Cliente de Discord configurado en el scheduler');
}

async function executeScheduledTask(action) {
    if (!client || !client.isReady()) {
        console.error('❌ Cliente de Discord no está listo');
        return;
    }

    try {
        console.log(`📅 Ejecutando tarea programada: ${action.name}`);

        if (!action.enabled) {
            console.log(`⏸️ Tarea ${action.name} está deshabilitada`);
            return;
        }

        const config = typeof action.config === 'string' ? JSON.parse(action.config) : action.config;

        if (config.taskType === 'estudiantes-expulsados') {
            await executeExpelledStudentsReport(config);
            return;
        }

        if (config.taskChannel && config.taskMessage) {
            const channel = await client.channels.fetch(config.taskChannel);
            if (channel && channel.isTextBased()) {
                let message = config.taskMessage;
                
                if (message.includes('{{EXPULSADOS}}')) {
                    const expelled = await calculateExpelledStudents(config.guildId);
                    message = message.replace(/\{\{EXPULSADOS\}\}/g, expelled.toString());
                }

                await channel.send(message);
                console.log(`✅ Mensaje enviado a canal ${channel.name}`);
            }
        }
    } catch (error) {
        console.error(`❌ Error ejecutando tarea ${action.name}:`, error);
    }
}

async function calculateExpelledStudents(guildId) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return 0;

        await guild.members.fetch();

        const nslRole = guild.roles.cache.find(r => r.name === 'NSL');
        const estudianteOficialRole = guild.roles.cache.find(r => r.name === 'Estudiante Privado Oficial');

        if (!nslRole || !estudianteOficialRole) return 0;

        const nslCount = nslRole.members.size;
        const estudianteCount = estudianteOficialRole.members.size;
        return nslCount - estudianteCount;
    } catch (error) {
        console.error('Error calculando estudiantes expulsados:', error);
        return 0;
    }
}

async function executeExpelledStudentsReport(config) {
    try {
        const expelled = await calculateExpelledStudents(config.guildId);
        
        const message = config.taskMessage.replace(/\{\{EXPULSADOS\}\}/g, expelled.toString());

        const channel = await client.channels.fetch(config.taskChannel);
        if (channel && channel.isTextBased()) {
            await channel.send(message);
            console.log(`✅ Reporte de expulsados enviado: ${expelled} estudiantes`);
        }
    } catch (error) {
        console.error('Error enviando reporte de expulsados:', error);
    }
}

async function disableOneTimeTask(actionId) {
    try {
        const pool = getPool();
        await pool.query(
            'UPDATE actions SET enabled = false WHERE id = $1',
            [actionId]
        );
        console.log(`✅ Tarea una-vez deshabilitada: ${actionId}`);
    } catch (error) {
        console.error('Error deshabilitando tarea:', error);
    }
}

function parseCronExpression(frequency, datetime) {
    switch (frequency) {
        case 'una-vez':
            return null;
        case 'diaria':
            if (datetime) {
                const date = new Date(datetime);
                return `${date.getMinutes()} ${date.getHours()} * * *`;
            }
            return '0 9 * * *';
        case 'semanal':
            if (datetime) {
                const date = new Date(datetime);
                const dayOfWeek = date.getDay();
                return `${date.getMinutes()} ${date.getHours()} * * ${dayOfWeek}`;
            }
            return '0 9 * * 1';
        case 'mensual':
            if (datetime) {
                const date = new Date(datetime);
                return `${date.getMinutes()} ${date.getHours()} ${date.getDate()} * *`;
            }
            return '0 9 1 * *';
        default:
            return null;
    }
}

async function scheduleOneTimeTask(action, datetime) {
    let targetTime;
    
    if (datetime.endsWith('Z') || datetime.includes('+') || datetime.includes('T') && datetime.split('T')[1].includes('-')) {
        targetTime = new Date(datetime);
    } else {
        const dateStr = datetime.includes('T') ? datetime : datetime.replace(' ', 'T');
        targetTime = new Date(dateStr + '-05:00');
    }
    
    const now = new Date();
    const delay = targetTime.getTime() - now.getTime();

    console.log(`🕐 Hora actual: ${now.toLocaleString('es-CO', {timeZone: 'America/Bogota'})} (${now.toISOString()})`);
    console.log(`🎯 Hora objetivo: ${targetTime.toLocaleString('es-CO', {timeZone: 'America/Bogota'})} (${targetTime.toISOString()})`);
    console.log(`⏱️ Delay: ${delay}ms (${Math.round(delay/1000)}s) = ${Math.round(delay/60000)} minutos`);

    if (delay > 0) {
        const timeoutId = setTimeout(async () => {
            console.log(`🚀 Ejecutando tarea programada: ${action.name}`);
            await executeScheduledTask(action);
            await disableOneTimeTask(action.id);
            activeTimeouts.delete(action.id);
        }, delay);
        
        activeTimeouts.set(action.id, timeoutId);
        console.log(`⏰ Tarea "${action.name}" programada para ${targetTime.toLocaleString('es-CO', {timeZone: 'America/Bogota'})}`);
        return timeoutId;
    } else {
        console.log(`⚠️ La fecha/hora ya pasó (hace ${Math.abs(Math.round(delay/60000))} minutos)`);
        await disableOneTimeTask(action.id);
        return null;
    }
}

async function initScheduler() {
    console.log('🕐 Iniciando sistema de tareas programadas...');

    try {
        const pool = getPool();
        const result = await pool.query(
            "SELECT * FROM actions WHERE type = 'scheduled' AND enabled = true"
        );

        console.log(`📋 ${result.rows.length} tareas programadas activas encontradas`);

        for (const row of result.rows) {
            const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
            const action = {
                id: row.id,
                name: row.name,
                type: row.type,
                enabled: row.enabled,
                config: config
            };

            const cronExpression = parseCronExpression(config.frequency, config.datetime);

            if (config.frequency === 'una-vez' && config.datetime) {
                await scheduleOneTimeTask(action, config.datetime);
            } else if (cronExpression) {
                cron.schedule(cronExpression, () => {
                    executeScheduledTask(action);
                });
                console.log(`✅ Tarea "${action.name}" programada con cron: ${cronExpression}`);
            }
        }

        console.log('✅ Sistema de tareas programadas iniciado correctamente');
    } catch (error) {
        console.error('❌ Error inicializando scheduler:', error);
    }
}

async function reloadScheduledTasks() {
    console.log('🔄 Recargando tareas programadas...');
    
    for (const [actionId, timeoutId] of activeTimeouts.entries()) {
        clearTimeout(timeoutId);
        console.log(`⏹️ Cancelada tarea: ${actionId}`);
    }
    activeTimeouts.clear();
    
    await initScheduler();
}

module.exports = {
    setClient,
    initScheduler,
    reloadScheduledTasks,
    executeScheduledTask
};