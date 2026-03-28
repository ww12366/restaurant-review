const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 配置 multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + Math.random().toString(36).substr(2) + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 20 }, // 10MB, 最多20张
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.gif'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('仅支持 jpg, png, gif 格式'));
        }
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'restaurant.html'));
});

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading data:', e);
    }
    return { users: [], restaurants: [] };
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: '请输入用户名和密码' });
    }
    const data = loadData();
    if (data.users.find(u => u.username === username)) {
        return res.status(400).json({ error: '用户名已存在' });
    }
    const user = {
        id: generateId(),
        username,
        password: hashPassword(password)
    };
    data.users.push(user);
    saveData(data);
    res.json({ success: true, user: { id: user.id, username: user.username } });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: '请输入用户名和密码' });
    }
    const data = loadData();
    const user = data.users.find(u => u.username === username && u.password === hashPassword(password));
    if (!user) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }
    res.json({ success: true, user: { id: user.id, username: user.username } });
});

app.get('/api/restaurants', (req, res) => {
    const data = loadData();
    const restaurants = data.restaurants.map(r => ({
        id: r.id,
        name: r.name,
        address: r.address,
        images: r.images || [],
        createdBy: r.createdBy,
        commentCount: r.comments.length,
        createdAt: r.createdAt
    }));
    res.json(restaurants);
});

app.post('/api/restaurants', upload.array('images', 20), (req, res) => {
    const { name, address, username } = req.body;
    if (!name || !address) {
        return res.status(400).json({ error: '请填写餐厅名称和地址' });
    }
    const data = loadData();
    const images = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];
    const restaurant = {
        id: generateId(),
        name,
        address,
        images: images,
        createdBy: username,
        comments: [],
        createdAt: new Date().toISOString()
    };
    data.restaurants.unshift(restaurant);
    saveData(data);
    res.json({ success: true, restaurant });
});

app.get('/api/restaurants/:id', (req, res) => {
    const data = loadData();
    const restaurant = data.restaurants.find(r => r.id === req.params.id);
    if (!restaurant) {
        return res.status(404).json({ error: '餐厅不存在' });
    }
    res.json(restaurant);
});

app.post('/api/restaurants/:id/comments', upload.array('images', 20), (req, res) => {
    const { username, text } = req.body;
    const textValue = text || '';
    const images = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];
    if (!textValue && images.length === 0) {
        return res.status(400).json({ error: '请输入评论内容或图片' });
    }
    const data = loadData();
    const restaurant = data.restaurants.find(r => r.id === req.params.id);
    if (!restaurant) {
        return res.status(404).json({ error: '餐厅不存在' });
    }
    const comment = {
        id: generateId(),
        author: username,
        text: text || '',
        images: images,
        time: new Date().toISOString()
    };
    restaurant.comments.unshift(comment);
    saveData(data);
    res.json({ success: true, comment });
});

app.listen(PORT, () => {
    console.log(`餐厅评分系统已运行: http://localhost:${PORT}`);
});
