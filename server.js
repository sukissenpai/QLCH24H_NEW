const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = 3000;

// Kết nối PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'qlch24h_db',
  password: '3112005', 
  port: 5432,
});

// Cấu hình session để lưu thông tin đăng nhập
app.use(session({
  secret: 'qlch24h_super_secret_key_2025',  
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 } 
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware truyền role và username từ session cho tất cả các trang
app.use((req, res, next) => {
  res.locals.role = req.session.role || 'staff';
  res.locals.username = req.session.username || 'Guest';
  next();
});

// Trang đăng nhập
app.get('/', (req, res) => {
  res.render('login', { error: null });
});

// Xử lý đăng nhập
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      req.session.user_id = user.id;
      req.session.role = user.role;
      req.session.username = user.username;
      res.redirect('/dashboard');
    } else {
      res.render('login', { error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { error: 'Lỗi hệ thống, vui lòng thử lại' });
  }
});

// Trang chủ sau khi đăng nhập
app.get('/dashboard', (req, res) => {
  res.render('dashboard');
});

// Quản lý sản phẩm
app.get('/products', async (req, res) => {
  const search = req.query.search || '';
  const result = await pool.query(`SELECT * FROM products WHERE name ILIKE $1 ORDER BY id`, [`%${search}%`]);
  const alerts = await pool.query('SELECT * FROM products WHERE stock < 10');
  res.render('products', { products: result.rows, alerts: alerts.rows });
});

// Thêm sản phẩm mới 
app.post('/products/add', async (req, res) => {
  const { name, price, stock, supplier } = req.body;
  const userId = req.session.user_id;
  try {
    await pool.query('BEGIN');

    // Thêm sản phẩm
    const productResult = await pool.query(
      'INSERT INTO products (name, price, stock, supplier) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, price, stock, supplier || null]
    );
    const productId = productResult.rows[0].id;

    // Nếu stock ban đầu > 0, lưu log nhập kho ban đầu
    if (parseInt(stock) > 0) {
      await pool.query(
        'INSERT INTO inventory_logs (product_id, action, quantity, note, date, user_id) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)',
        [productId, 'in', parseInt(stock), 'Nhập kho ban đầu khi thêm sản phẩm mới', userId]
      );
    }

    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Add product error:', err);
  }
  res.redirect('/products');
});

// Quản lý tồn kho
app.get('/inventory', async (req, res) => {
  const products = await pool.query('SELECT * FROM products ORDER BY name');
  const logs = await pool.query('SELECT * FROM inventory_logs ORDER BY date DESC LIMIT 50');
  const lowStock = await pool.query('SELECT * FROM products WHERE stock < 10');
  res.render('inventory', { products: products.rows, logs: logs.rows, lowStock: lowStock.rows });
});

// Nhập kho cho sản phẩm hiện có 
app.post('/inventory/in', async (req, res) => {
  const { product_id, quantity, note } = req.body;
  const userId = req.session.user_id;
  try {
    await pool.query('BEGIN');

    // Tăng stock
    await pool.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [parseInt(quantity), product_id]);

    // Lưu log
    await pool.query(
      'INSERT INTO inventory_logs (product_id, action, quantity, note, date, user_id) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)',
      [product_id, 'in', parseInt(quantity), note || 'Nhập kho từ trang quản lý tồn kho', userId]
    );

    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Import stock error:', err);
  }
  res.redirect('/inventory');
});

// Trang nhân viên
app.get('/employees', async (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).send('<h1>403 - Không có quyền truy cập</h1><p>Chỉ Quản lý mới được phép vào trang này.</p><a href="/dashboard">Quay về trang chủ</a>');
  }
  const employees = await pool.query('SELECT e.*, u.role FROM employees e JOIN users u ON e.user_id = u.id');
  const shifts = await pool.query('SELECT * FROM shifts ORDER BY start_time DESC');
  res.render('employees', { employees: employees.rows, shifts: shifts.rows });
});

// Set lịch làm việc cho nhân viên
app.post('/employees/add_shift', async (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).send('<h1>403 - Không có quyền truy cập</h1><p>Chỉ Quản lý mới được phép vào trang này.</p><a href="/dashboard">Quay về trang chủ</a>');
  }
  const { employee_id, start_time, end_time } = req.body;
  try {
    await pool.query(
      'INSERT INTO shifts (employee_id, start_time, end_time, status, shift_date) VALUES ($1, $2, $3, $4, $5)',
      [employee_id, start_time, end_time, 'scheduled', new Date(start_time).toISOString().split('T')[0]]
    );
    res.redirect('/employees');
  } catch (err) {
    console.error('Add shift error:', err);
    res.status(500).send('Lỗi hệ thống, vui lòng thử lại');
  }
});

// Trang bán hàng
app.get('/sales', async (req, res) => {
  const products = await pool.query('SELECT * FROM products ORDER BY name');
  res.render('sales', { products: products.rows });
});

// Xử lý thanh toán (giảm tồn kho + lưu doanh thu)
app.post('/sales/complete', async (req, res) => {
  const { items, total, payment_method } = req.body;
  const userId = req.session.user_id;

  if (!items || items.length === 0 || total <= 0) {
    return res.json({ success: false, message: 'Giỏ hàng trống!' });
  }

  try {
    await pool.query('BEGIN');

    // Lấy employee_id từ user_id
    const employeeResult = await pool.query('SELECT id FROM employees WHERE user_id = $1', [userId]);
    const employeeId = employeeResult.rows.length > 0 ? employeeResult.rows[0].id : null;

    // Lưu hóa đơn
    const saleResult = await pool.query(
      'INSERT INTO sales (employee_id, total_amount, payment_method, user_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [employeeId, total, payment_method, userId]
    );
    const saleId = saleResult.rows[0].id;

    // Xử lý từng sản phẩm: giảm tồn kho + lưu chi tiết + log xuất kho
    for (let item of items) {
      const productId = item.id;
      const quantity = parseInt(item.quantity);

      if (quantity > 0) {
        // Kiểm tra tồn kho
        const stockCheck = await pool.query('SELECT stock, price FROM products WHERE id = $1', [productId]);
        if (stockCheck.rows[0].stock < quantity) {
          throw new Error(`Sản phẩm ID ${productId} không đủ hàng`);
        }

        // Giảm tồn kho
        await pool.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [quantity, productId]);

        // Lưu chi tiết hóa đơn
        await pool.query(
          'INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
          [saleId, productId, quantity, stockCheck.rows[0].price]
        );

        // Lưu log xuất kho 
        await pool.query(
          'INSERT INTO inventory_logs (product_id, action, quantity, note, user_id) VALUES ($1, $2, $3, $4, $5)',
          [productId, 'out', quantity, 'Xuất kho do bán hàng', userId]
        );
      }
    }

    await pool.query('COMMIT');
    res.json({ success: true, message: 'Thanh toán thành công! Tồn kho và doanh thu đã cập nhật.' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Payment error:', err);
    res.json({ success: false, message: 'Thanh toán thất bại: ' + err.message });
  }
});

// Trang báo cáo
app.get('/reports', async (req, res) => {
  const revenueDay = await pool.query('SELECT SUM(total_amount) AS sum FROM sales WHERE date::date = CURRENT_DATE');
  const revenueWeek = await pool.query('SELECT SUM(total_amount) AS sum FROM sales WHERE date >= CURRENT_DATE - INTERVAL \'7 days\'');
  res.render('reports', { day: revenueDay.rows[0].sum || 0, week: revenueWeek.rows[0].sum || 0 });
});

// Đăng xuất
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));