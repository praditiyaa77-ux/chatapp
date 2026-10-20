const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(__dirname));

const DB_FILE = path.join(__dirname, 'db.json');

// Inisialisasi Database
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }));
}

const readDB = () => JSON.parse(fs.readFileSync(DB_FILE));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// === API ROUTES ===

// Register
app.post('/api/register', (req, res) => {
    const { username, password, pin } = req.body;
    const db = readDB();

    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username sudah digunakan' });
    }

    // Simulasi enkripsi sederhana (Di production gunakan bcrypt)
    const newUser = { 
        username, 
        password: Buffer.from(password).toString('base64'), 
        pin: Buffer.from(pin).toString('base64'),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
    };
    
    db.users.push(newUser);
    writeDB(db);
    res.json({ success: true, user: { username: newUser.username, avatar: newUser.avatar } });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password, pin } = req.body;
    const db = readDB();
    
    const user = db.users.find(u => u.username === username);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    const validPassword = user.password === Buffer.from(password).toString('base64');
    const validPin = user.pin === Buffer.from(pin).toString('base64');

    if (!validPassword || !validPin) {
        return res.status(401).json({ error: 'Password atau PIN salah' });
    }

    res.json({ success: true, user: { username: user.username, avatar: user.avatar } });
});

// Cari User
app.get('/api/users', (req, res) => {
    const { search } = req.query;
    const db = readDB();
    const results = db.users
        .filter(u => u.username.toLowerCase().includes(search.toLowerCase()))
        .map(u => ({ username: u.username, avatar: u.avatar })); // Jangan kirim password/pin
    res.json(results);
});

// === SOCKET.IO LOGIC ===
io.on('connection', (socket) => {
    console.log('User terhubung:', socket.id);

    // Bergabung ke room (Public atau Private)
    socket.on('joinRoom', (room) => {
        socket.join(room);
    });

    // Menerima dan meneruskan pesan
    socket.on('chat message', (data) => {
        // Kirim ke room tertentu (Public atau Private)
        io.to(data.room).emit('chat message', data);
    });

    socket.on('disconnect', () => {
        console.log('User terputus');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
