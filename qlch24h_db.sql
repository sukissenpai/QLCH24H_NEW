CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE,
  password VARCHAR(255),
  role VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  position VARCHAR(50),
  salary DECIMAL,
  user_id INT REFERENCES users(id)
);

CREATE TABLE shifts (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  status VARCHAR(20) DEFAULT 'scheduled'
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  price DECIMAL,
  stock INT DEFAULT 0,
  supplier VARCHAR(100)
);

CREATE TABLE inventory_logs (
  id SERIAL PRIMARY KEY,
  product_id INT REFERENCES products(id),
  action VARCHAR(10), -- in, out
  quantity INT,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  note VARCHAR(255)
);

CREATE TABLE sales (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id),
  total_amount DECIMAL,
  payment_method VARCHAR(20),
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'completed'
);

CREATE TABLE sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INT REFERENCES sales(id),
  product_id INT REFERENCES products(id),
  quantity INT,
  price DECIMAL
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);

ALTER TABLE sales ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS shift_date DATE DEFAULT CURRENT_DATE;

--------------------------------------------------------------------------------------------------------------------------------------------
INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin'), ('staff', 'staff123', 'staff');

INSERT INTO employees (name, position, salary, user_id) VALUES ('Admin', 'Manager', 30000000, 1), ('Staff', 'Cashier', 5000000, 2);

-- Thêm thêm người dùng
INSERT INTO users (username, password, role, status) VALUES
('ql1', 'ql123', 'manager', 'active'),
('nv1', 'nv123', 'staff', 'active'),
('nv2', 'nv123', 'staff', 'active');

-- Thêm thêm nhân viên
INSERT INTO employees (name, position, salary, user_id) VALUES
('Nhựt Duy', 'Manager', 12000000, 3),
('Nhật Huy', 'Cashier', 6000000, 4),
('Trọng Khương', 'Cashier', 6000000, 5);

-- Thêm thêm sản phẩm
INSERT INTO products (name, price, stock, supplier, image_url) VALUES
('Nước ngọt Coca', 15000, 100, 'Coca-Cola', 'https://example.com/images/coca.jpg'),
('Kẹo cao su', 5000, 200, 'Orbit', 'https://example.com/images/gum.jpg'),
('Bia Heineken', 25000, 50, 'Heineken', 'https://example.com/images/heineken.jpg'),
('Trà xanh', 10000, 80, 'Oishi', 'https://example.com/images/tea.jpg'),
('Bánh quy', 12000, 60, 'Oreo', 'https://example.com/images/oreo.jpg');

-- Thêm ca làm việc 
INSERT INTO shifts (employee_id, start_time, end_time, status, shift_date) VALUES
(1, '2025-12-18 08:00:00', '2025-12-18 16:00:00', 'scheduled', '2025-12-18'),
(2, '2025-12-18 16:00:00', '2025-12-19 00:00:00', 'scheduled', '2025-12-18'),
(3, '2025-12-19 08:00:00', '2025-12-19 16:00:00', 'scheduled', '2025-12-19'),
(4, '2025-12-19 16:00:00', '2025-12-20 00:00:00', 'scheduled', '2025-12-19'),
(5, '2025-12-20 08:00:00', '2025-12-20 16:00:00', 'scheduled', '2025-12-20');

-- Thêm log tồn kho 
INSERT INTO inventory_logs (product_id, action, quantity, note, user_id) VALUES
((SELECT id FROM products WHERE name = 'Nước ngọt Coca'), 'in', 100, 'Nhập kho Coca', 1),
((SELECT id FROM products WHERE name = 'Kẹo cao su'), 'in', 200, 'Nhập kho Kẹo', 1),
((SELECT id FROM products WHERE name = 'Bia Heineken'), 'in', 50, 'Nhập kho Bia', 1),
((SELECT id FROM products WHERE name = 'Trà xanh'), 'in', 80, 'Nhập kho Trà', 1),
((SELECT id FROM products WHERE name = 'Bánh quy'), 'in', 60, 'Nhập kho Bánh quy', 1);

DO $$
DECLARE
  sale_id1 INT;
  sale_id2 INT;
  sale_id3 INT;
BEGIN
  -- Hóa đơn 1
  INSERT INTO sales (employee_id, total_amount, payment_method, user_id)
  VALUES (2, 30000, 'cash', 2)
  RETURNING id INTO sale_id1;

  INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES
  (sale_id1, (SELECT id FROM products WHERE name = 'Sữa tươi'), 1, 20000),
  (sale_id1, (SELECT id FROM products WHERE name = 'Bánh mì'), 1, 10000);

  -- Hóa đơn 2
  INSERT INTO sales (employee_id, total_amount, payment_method, user_id)
  VALUES (4, 20000, 'card', 4)
  RETURNING id INTO sale_id2;

  INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES
  (sale_id2, (SELECT id FROM products WHERE name = 'Nước ngọt Coca'), 1, 15000),
  (sale_id2, (SELECT id FROM products WHERE name = 'Kẹo cao su'), 1, 5000);

  -- Hóa đơn 3
  INSERT INTO sales (employee_id, total_amount, payment_method, user_id)
  VALUES (5, 35000, 'cash', 5)
  RETURNING id INTO sale_id3;

  INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES
  (sale_id3, (SELECT id FROM products WHERE name = 'Bia Heineken'), 1, 25000),
  (sale_id3, (SELECT id FROM products WHERE name = 'Trà xanh'), 1, 10000);
END $$;

--------------------------------------------------------------------------------------------------------------------------------------------
SELECT * FROM users ORDER BY id;

SELECT e.*, u.username, u.role
FROM employees e
JOIN users u ON e.user_id = u.id
ORDER BY e.id;

SELECT s.*, e.name AS employee_name
FROM shifts s
JOIN employees e ON s.employee_id = e.id
ORDER BY s.shift_date DESC, s.start_time;

SELECT * FROM products ORDER BY name;

SELECT * FROM products WHERE stock < 10 ORDER BY stock ASC;

SELECT il.*, p.name AS product_name, u.username AS user_name
FROM inventory_logs il
JOIN products p ON il.product_id = p.id
LEFT JOIN users u ON il.user_id = u.id
ORDER BY il.date DESC LIMIT 20;

SELECT s.*, e.name AS employee_name, u.username AS user_name
FROM sales s
JOIN employees e ON s.employee_id = e.id
JOIN users u ON s.user_id = u.id
ORDER BY s.date DESC;

SELECT si.*, s.date AS sale_date, p.name AS product_name
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
JOIN products p ON si.product_id = p.id
ORDER BY s.date DESC;
