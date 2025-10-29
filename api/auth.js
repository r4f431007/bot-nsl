const express = require('express');
const router = express.Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'rafa.0.0.7@hotmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Db6aedf7028.';

router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        req.session.authenticated = true;
        req.session.save((err) => {
            if (err) {
                console.error('Error guardando sesión:', err);
                return res.status(500).json({ 
                    success: false,
                    error: 'Error al guardar sesión' 
                });
            }
            res.json({ success: true });
        });
    } else {
        res.status(401).json({ 
            success: false,
            error: 'Credenciales incorrectas' 
        });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destruyendo sesión:', err);
        }
        res.json({ success: true });
    });
});

router.get('/check-auth', (req, res) => {
    res.json({ 
        authenticated: !!req.session.authenticated 
    });
});

module.exports = router;