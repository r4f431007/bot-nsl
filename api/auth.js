const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'rafa.0.0.7@hotmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Db6aedf7028.';
const JWT_SECRET = process.env.SESSION_SECRET || 'discord-dashboard-secret-key-change-this';

router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const token = jwt.sign(
            { authenticated: true, email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/'
        });

        res.json({ success: true });
    } else {
        res.status(401).json({ 
            success: false,
            error: 'Credenciales incorrectas' 
        });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
    });
    res.json({ success: true });
});

router.get('/check-auth', (req, res) => {
    const token = req.cookies.auth_token;
    
    if (!token) {
        return res.json({ authenticated: false });
    }

    try {
        jwt.verify(token, JWT_SECRET);
        res.json({ authenticated: true });
    } catch (error) {
        res.json({ authenticated: false });
    }
});

module.exports = router;