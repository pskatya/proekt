const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const os = require('os');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.log("MongoDB connection error: ", err));

// Модели
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    password: String,
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
}));

const Note = mongoose.model('Note', new mongoose.Schema({
    title: String,
    content: String,
    visibility: { type: String, enum: ['public', 'private'], default: 'private' },
    tags: [String],
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Ссылка на пользователя
    createdAt: { type: Date, default: Date.now },
}));

// Регистрация
app.post('/api/register', async(req, res) => {
    const { name, password, role } = req.body;

    try {
        const existingUser = await User.findOne({ name });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists. Please log in instead.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, password: hashedPassword, role });

        await newUser.save();

        const token = jwt.sign({
            userId: newUser._id,
            name: newUser.name,
            role: newUser.role
        }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({ message: 'User registered successfully', token });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user' });
    }
});

// Логин пользователя
app.post('/api/login', async(req, res) => {
    const { name, password } = req.body;
    const user = await User.findOne({ name });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid password' });

    const token = jwt.sign({
        userId: user._id,
        name: user.name,
        role: user.role
    }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

// Middleware для аутентификации
const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;
    if (!token) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = decoded;
        next();
    });
};

// Системная информация
app.get('/system-info', async(req, res) => {
    try {
        const filePath = path.join(__dirname, 'info.txt');
        const fileData = await fs.promises.readFile(filePath, 'utf8');
        const systemInfo = {
            hostname: os.hostname(),
            platform: os.platform(),
            architecture: os.arch(),
            cpuCount: os.cpus().length,
            freeMemory: os.freemem(),
            totalMemory: os.totalmem(),
        };
        res.json({ fileData, systemInfo });
    } catch (error) {
        console.error('Error retrieving system info:', error);
        res.status(500).send('Error retrieving system info');
    }
});


// Получение заметок с фильтрацией по тегам и видимости
app.get('/api/notes', authMiddleware, async(req, res) => {
    const { role, userId } = req.user;
    const { tag, visibility } = req.query;

    const filter = {};
    if (tag) filter.tags = { $in: tag.split(',').map(t => t.trim()) };
    if (visibility) filter.visibility = visibility;
    if (visibility === 'private') {
        filter.$or = [{ userId: userId }, { visibility: 'public' }];
    }

    const notes = await Note.find(filter).populate('userId', 'name');
    res.json(notes);
});


// Создание заметки
app.post('/api/notes', authMiddleware, async(req, res) => {
    const { title, content, visibility, tags } = req.body;
    const userId = req.user.userId;

    const note = new Note({
        title,
        content,
        visibility,
        tags,
        userId
    });

    try {
        await note.save();
        res.status(201).json({ message: 'Note created successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error creating note' });
    }
});

// Удаление заметки
app.delete('/api/notes/:id', authMiddleware, async(req, res) => {
    const { id } = req.params;
    const note = await Note.findById(id).populate('userId', 'name');

    if (!note) {
        return res.status(404).json({ message: 'Note not found' });
    }
    if (note.visibility === 'public' && note.userId._id.toString() !== req.user.userId.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'You cannot delete a public note that you do not own' });
    }

    await note.deleteOne();
    res.json({ message: 'Note deleted successfully' });
});

// Получение конкретной заметки по ID
app.get('/api/notes/:id', authMiddleware, async(req, res) => {
    const { id } = req.params;
    try {
        const note = await Note.findById(id).populate('userId', 'name');
        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }
        res.json(note);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving note' });
    }
});

// Обновление заметки
app.put('/api/notes/:id', authMiddleware, async(req, res) => {
    const { id } = req.params;
    const { title, content, visibility, tags } = req.body;

    const note = await Note.findById(id);

    if (!note) {
        return res.status(404).json({ message: 'Note not found' });
    }

    if (note.visibility === 'public') {
        return res.status(403).json({ message: 'You cannot edit a public note' });
    }

    if (note.userId.toString() !== req.user.userId.toString()) {
        return res.status(403).json({ message: 'You cannot edit a note that you do not own' });
    }

    note.title = title;
    note.content = content;
    note.visibility = visibility;
    note.tags = tags;

    try {
        await note.save();
        res.status(200).json({ message: 'Note updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating note' });
    }
});



app.listen(port, () => console.log(`Server running on port ${port}`));