const cron = require('node-cron');
const { getPool } = require('./db');

let client = null;

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

        // Verificar que la tarea esté habilitada
        if (!action.enabled) {
            console.log(`⏸️ Tarea ${action.name} está deshabilitada`);
            return;
        }

        const config = typeof action.config === 'string' ? JSON.parse(action.config) : action.config;

        // Caso especial: Reporte de Estudiantes Expulsados
        if (config.taskType === 'estudiantes-expulsados') {
            await executeExpelledStudentsReport(config);
            return;
        }

        // Otras tareas programadas
        if (config.taskChannel && config.taskMessage) {
            const channel = await client.channels.fetch(config.taskChannel);
            if (channel && channel.isTextBased()) {
                // Reemplazar variables dinámicas
                let message = config.taskMessage;
                
                // Si el mensaje contiene {{EXPULSADOS}}, calcularlo
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

function parseCronExpression(frequency, datetime) {
    // Convertir frecuencia a expresión cron
    switch (frequency) {
        case 'una-vez':
            // Para una sola vez, usaremos una tarea específica
            return null;
        case 'diaria':
            // Ejecutar todos los días a la hora especificada
            if (datetime) {
                const date = new Date(datetime);
                return `${date.getMinutes()} ${date.getHours()} * * *`;
            }
            return '0 9 * * *'; // Por defecto a las 9 AM
        case 'semanal':
            // Ejecutar semanalmente
            if (datetime) {
                const date = new Date(datetime);
                const dayOfWeek = date.getDay();
                return `${date.getMinutes()} ${date.getHours()} * * ${dayOfWeek}`;
            }
            return '0 9 * * 1'; // Por defecto lunes a las 9 AM
        case 'mensual':
            // Ejecutar mensualmente
            if (datetime) {
                const date = new Date(datetime);
                return `${date.getMinutes()} ${date.getHours()} ${date.getDate()} * *`;
            }
            return '0 9 1 * *'; // Por defecto primer día del mes
        default:
            return null;
    }
}

async function scheduleOneTimeTask(action, datetime) {
    const targetTime = new Date(datetime);
    const now = new Date();
    const delay = targetTime.getTime() - now.getTime();

    if (delay > 0) {
        setTimeout(() => {
            executeScheduledTask(action);
        }, delay);
        console.log(`⏰ Tarea única programada para ${targetTime.toLocaleString()}`);
    } else {
        console.log(`⚠️ La fecha/hora ya pasó para la tarea ${action.name}`);
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

// Recargar tareas cuando se crean nuevas
async function reloadScheduledTasks() {
    console.log('🔄 Recargando tareas programadas...');
    // En un sistema real, deberías detener las tareas existentes y recargarlas
    // Por simplicidad, simplemente reiniciamos
    await initScheduler();
}

module.exports = {
    setClient,
    initScheduler,
    reloadScheduledTasks,
    executeScheduledTask
};