# Discord Dashboard

Dashboard web para enviar mensajes a canales de Discord desde un navegador.

## Estructura del Proyecto

```
discord-dashboard/
├── api/                    # Carpeta con rutas organizadas
│   ├── auth.js            # Rutas de autenticación
│   └── discord.js         # Rutas de Discord
├── public/                # Archivos del frontend
│   ├── index.html         # Dashboard principal
│   ├── style.css          # Estilos del dashboard
│   ├── script.js          # JavaScript del dashboard
│   ├── login.html         # Página de login
│   ├── login-style.css    # Estilos del login
│   └── login-script.js    # JavaScript del login
├── server.js              # Servidor Express
├── package.json           # Dependencias
├── .env.example           # Ejemplo de variables de entorno
└── .gitignore            # Archivos ignorados por Git
```

## Instalación

1. Instala las dependencias:
```bash
npm install
```

2. Crea un archivo `.env` basado en `.env.example`:
```bash
cp .env.example .env
```

3. Configura tus variables de entorno en `.env`:
```
DISCORD_TOKEN=tu_token_del_bot
PORT=3000
ADMIN_EMAIL=rafa.0.0.7@hotmail.com
ADMIN_PASSWORD=Db6aedf7028.
SESSION_SECRET=genera_un_secreto_aleatorio
NODE_ENV=production
```

Para generar SESSION_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. Inicia el servidor:
```bash
npm start
```

## Deployment en Vercel

1. Instala Vercel CLI:
```bash
npm i -g vercel
```

2. Despliega:
```bash
vercel
```

3. Configura las variables de entorno en Vercel Dashboard:
   - Settings → Environment Variables
   - Agrega todas las variables del archivo `.env`

## Características

- ✅ Login seguro con sesiones
- ✅ Selección de canales de Discord
- ✅ Envío de mensajes
- ✅ Mensajes de error claros
- ✅ Diseño responsive
- ✅ Rutas organizadas en carpeta `/api`

## Credenciales de Login

Email: rafa.0.0.7@hotmail.com
Password: Db6aedf7028.