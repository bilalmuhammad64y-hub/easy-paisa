const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safeName);
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));
app.use(express.static(__dirname));

app.use(session({
  secret: 'easy-paisa-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 }
}));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'customer' },
  createdAt: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  oldPrice: { type: Number, default: 0 },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  items: [{
    productId: String,
    name: String,
    price: Number,
    quantity: Number
  }],
  total: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);

async function seedData() {
  const adminExists = await User.findOne({ email: 'admin@stackmarket.com' });
  if (!adminExists) {
    const hashed = await bcrypt.hash('admin123', 10);
    await User.create({
      name: 'Admin User',
      email: 'admin@stackmarket.com',
      password: hashed,
      role: 'admin'
    });
  }

  const productCount = await Product.countDocuments();
  if (productCount === 0) {
    await Product.insertMany([
      {
        name: 'Wireless Headphones',
        category: 'Audio',
        price: 129,
        oldPrice: 179,
        description: 'Noise cancelling • Bluetooth 5.3',
        image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80'
      },
      {
        name: 'Smart Smartwatch',
        category: 'Wearables',
        price: 199,
        oldPrice: 249,
        description: 'Fitness tracking • AMOLED display',
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'
      },
      {
        name: 'Laptop Pro 14',
        category: 'Electronics',
        price: 899,
        oldPrice: 1099,
        description: 'Intel i7 • 16GB RAM',
        image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80'
      }
    ]);
  }
}

async function connectDatabase() {
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri('easy-paisa');
  await mongoose.connect(mongoUri);
  await seedData();
  console.log('MongoDB connected successfully');
}

function ensureAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(401).json({ message: 'Admin access required' });
  }
  next();
}

function ensureLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Please login first' });
  }
  next();
}

app.get('/', (req, res) => res.redirect('/html'));
app.get('/html', (req, res) => res.sendFile(path.join(__dirname, 'html')));
app.get('/products.html', (req, res) => res.sendFile(path.join(__dirname, 'products.html')));
app.get('/cart.html', (req, res) => res.sendFile(path.join(__dirname, 'cart.html')));
app.get('/checkout.html', (req, res) => res.sendFile(path.join(__dirname, 'checkout.html')));
app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, 'admin-login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin-panel.html')));
app.get('/customer/signup', (req, res) => res.sendFile(path.join(__dirname, 'customer-signup.html')));
app.get('/customer/login', (req, res) => res.sendFile(path.join(__dirname, 'customer-login.html')));

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  const admin = await User.findOne({ email, role: 'admin' });

  if (!admin) {
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }

  const match = await bcrypt.compare(password, admin.password);
  if (!match) {
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }

  req.session.user = { id: admin._id, email: admin.email, name: admin.name, role: 'admin' };
  return res.json({ success: true, message: 'Admin login successful' });
});

app.post('/api/login', async (req, res) => {
  return app._router.handle(req, res);
});

app.post('/api/customer/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: 'customer'
  });

  req.session.user = { id: user._id, name: user.name, email: user.email, role: 'customer' };
  res.status(201).json({ success: true, message: 'Signup successful', user: req.session.user });
});

app.post('/api/customer/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, role: 'customer' });

  if (!user) {
    return res.status(401).json({ message: 'Invalid customer credentials' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ message: 'Invalid customer credentials' });
  }

  req.session.user = { id: user._id, name: user.name, email: user.email, role: 'customer' };
  res.json({ success: true, message: 'Login successful', user: req.session.user });
});

app.get('/api/session', (req, res) => {
  res.json({ loggedIn: !!req.session.user, user: req.session.user || null });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out' });
  });
});

app.get('/api/products', async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
});

app.get('/api/products/search', async (req, res) => {
  const name = String(req.query.name || '').trim();
  if (!name) {
    return res.status(400).json({ message: 'Product name is required' });
  }

  const product = await Product.findOne({
    name: { $regex: name, $options: 'i' }
  }).sort({ createdAt: -1 });

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  res.json(product);
});

app.get('/api/products/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid product ID' });
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  res.json(product);
});

app.post('/api/products', upload.single('image'), ensureAdmin, async (req, res) => {
  const { name, category, price, oldPrice, description } = req.body;

  if (!name || !category || !price) {
    return res.status(400).json({ message: 'Name, category and price are required' });
  }

  const product = await Product.create({
    name,
    category,
    price: Number(price),
    oldPrice: Number(oldPrice || 0),
    description: description || '',
    image: req.file ? `/uploads/${req.file.filename}` : (req.body.image || '')
  });

  res.status(201).json({ message: 'Product added successfully', product });
});

app.put('/api/products/:id', upload.single('image'), ensureAdmin, async (req, res) => {
  const update = {
    name: req.body.name,
    category: req.body.category,
    price: Number(req.body.price),
    oldPrice: Number(req.body.oldPrice || 0),
    description: req.body.description || ''
  };

  if (req.file) {
    update.image = `/uploads/${req.file.filename}`;
  }

  const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  res.json({ message: 'Product updated successfully', product });
});

app.delete('/api/products/:id', ensureAdmin, async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  res.json({ message: 'Product deleted successfully' });
});

app.post('/api/orders', ensureLoggedIn, async (req, res) => {
  const { items, total } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0 || !total) {
    return res.status(400).json({ message: 'Order items are required' });
  }

  const order = await Order.create({
    customerId: req.session.user.id,
    items,
    total: Number(total)
  });

  res.status(201).json({ message: 'Order placed successfully', order });
});

app.get('/api/admin/stats', ensureAdmin, async (req, res) => {
  const [totalProducts, totalCustomers, totalOrders, revenueData] = await Promise.all([
    Product.countDocuments(),
    User.countDocuments({ role: 'customer' }),
    Order.countDocuments(),
    Order.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
    ])
  ]);

  const totalRevenue = revenueData[0]?.totalRevenue || 0;
  const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5).lean();

  res.json({
    totalProducts,
    totalCustomers,
    totalOrders,
    totalRevenue,
    recentOrders
  });
});

connectDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error('Database connection failed:', error);
  process.exit(1);
});
