// ─────────────────────────────────────────────────────────
//  Bloom Aquatics · Express + SQLite backend
//  Port    : 4567
//  DB      : ./bloom.db  (auto-created)
//  Backups : ./backups/  (7-day rolling + startup snapshots)
//  Uploads : ./uploads/  (product photos)
// ─────────────────────────────────────────────────────────
const express  = require('express');
const Database = require('better-sqlite3');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const app     = express();
const PORT    = 4567;
const DB_PATH = path.join(__dirname, 'bloom.db');
const BKP_DIR = path.join(__dirname, 'backups');
const UPL_DIR = path.join(__dirname, 'uploads');

// ── Ensure folders exist inside project ──────────────────
[BKP_DIR, UPL_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d); });

// ── Open / create database ────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS cost_centers (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '#7c3aed',
    photo_path TEXT
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id             TEXT PRIMARY KEY,
    date           TEXT NOT NULL,
    type           TEXT NOT NULL CHECK(type IN ('income','expense')),
    desc           TEXT NOT NULL,
    amount         REAL NOT NULL,
    cc_id          TEXT NOT NULL,
    payment        TEXT NOT NULL DEFAULT 'Efectivo',
    notes          TEXT,
    linked_item_id TEXT,
    created_at     TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS inventory (
    id             TEXT PRIMARY KEY,
    type           TEXT NOT NULL CHECK(type IN ('product','plant','supply')),
    name           TEXT NOT NULL,
    purchase_date  TEXT NOT NULL,
    purchase_price REAL NOT NULL DEFAULT 0,
    cc_id          TEXT NOT NULL,
    qty            REAL NOT NULL DEFAULT 1,
    unit           TEXT NOT NULL DEFAULT 'unidad',
    notes          TEXT,
    status         TEXT NOT NULL DEFAULT 'available',
    created_at     TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS inventory_sales (
    id           TEXT PRIMARY KEY,
    inventory_id TEXT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    sale_date    TEXT NOT NULL,
    sale_price   REAL NOT NULL,
    platform     TEXT,
    payment      TEXT DEFAULT 'Efectivo',
    notes        TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );
`);

// ── Safe migration: add photo_path column ─────────────────
// ALTER TABLE ADD COLUMN never touches existing rows.
// SQLite throws if column already exists — we ignore that error.
try {
  db.exec('ALTER TABLE inventory ADD COLUMN photo_path TEXT');
  console.log('[DB] Migration OK: photo_path column added.');
} catch {
  // column already exists — no action needed
}

// ── Safe migration: add selling_price column ───────────────
try {
  db.exec('ALTER TABLE inventory ADD COLUMN selling_price REAL');
  console.log('[DB] Migration OK: selling_price column added.');
} catch {
  // column already exists — no action needed
}

// ── Safe migration: add description column to inventory ───
try {
  db.exec('ALTER TABLE inventory ADD COLUMN description TEXT');
  console.log('[DB] Migration OK: description column added.');
} catch { /* already exists */ }

// ── Safe migration: add is_available column to inventory ──
try {
  db.exec('ALTER TABLE inventory ADD COLUMN is_available INTEGER NOT NULL DEFAULT 1');
  console.log('[DB] Migration OK: is_available column added.');
} catch { /* already exists */ }

// ── Safe migration: add photo_path to cost_centers ────────
try {
  db.exec('ALTER TABLE cost_centers ADD COLUMN photo_path TEXT');
  console.log('[DB] Migration OK: cost_centers.photo_path added.');
} catch { /* already exists */ }

// ── Seed default cost centers if brand new ────────────────
const ccCount = db.prepare('SELECT COUNT(*) AS c FROM cost_centers').get().c;
if (ccCount === 0) {
  db.prepare('INSERT INTO cost_centers (id,name,color) VALUES (?,?,?)').run('cc1','Carito','#7c3aed');
  db.prepare('INSERT INTO cost_centers (id,name,color) VALUES (?,?,?)').run('cc2','Eileencita','#d97706');
  console.log('[DB] Default cost centers seeded.');
}

// ── Backups ───────────────────────────────────────────────
const DAY_NAMES = ['dom','lun','mar','mie','jue','vie','sab'];

async function doBackup(label) {
  const name = label || DAY_NAMES[new Date().getDay()];
  const dest = path.join(BKP_DIR, `${name}.db`);
  try {
    await db.backup(dest);
    console.log(`[Backup] ${name}.db saved.`);
  } catch (err) {
    console.error('[Backup] Error:', err.message);
  }
}

// Startup snapshot — keeps last 5, deletes older ones automatically
const ts = new Date().toISOString().slice(0,16).replace('T','_').replace(':','h');
doBackup(`startup_${ts}`);
try {
  const old = fs.readdirSync(BKP_DIR).filter(f=>f.startsWith('startup_')).sort().reverse();
  old.slice(5).forEach(f => fs.unlinkSync(path.join(BKP_DIR, f)));
} catch {}

// Daily rolling backup (overwrites same weekday from last week)
doBackup();
let lastDay = new Date().getDay();
setInterval(() => {
  const d = new Date().getDay();
  if (d !== lastDay) { lastDay = d; doBackup(); }
}, 60 * 60 * 1000);

// ── Multer config ─────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPL_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    // filename = itemId + extension  (replaces any previous photo)
    cb(null, `${req.params.itemId}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },  // 8 MB max
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

// ── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use('/uploads', express.static(UPL_DIR));   // serve photos

const DIST = path.join(__dirname, 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false }));
} else {
  console.warn('[Warning] No ./dist found — run "npm run build" first.');
}

// ── Cost Centers ──────────────────────────────────────────
app.get('/api/cost-centers', (_req, res) => {
  const rows = db.prepare('SELECT * FROM cost_centers ORDER BY rowid').all();
  res.json(rows.map(r => ({ id:r.id, name:r.name, color:r.color, photoPath:r.photo_path||null })));
});

app.post('/api/cost-centers', (req, res) => {
  const { id, name, color } = req.body;
  db.prepare('INSERT INTO cost_centers (id,name,color) VALUES (?,?,?)').run(id, name, color);
  res.json({ ok: true });
});


app.patch('/api/cost-centers/:id', (req, res) => {
  const { name, color } = req.body;
  db.prepare('UPDATE cost_centers SET name=?, color=? WHERE id=?')
    .run(name, color, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/cost-centers/:id', (req, res) => {
  db.prepare('DELETE FROM cost_centers WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Transactions ──────────────────────────────────────────
app.get('/api/transactions', (_req, res) => {
  const rows = db.prepare('SELECT * FROM transactions ORDER BY date DESC, created_at DESC').all();
  res.json(rows.map(r => ({
    id: r.id, date: r.date, type: r.type, desc: r.desc,
    amount: r.amount, ccId: r.cc_id, payment: r.payment,
    notes: r.notes, linkedItemId: r.linked_item_id,
  })));
});

app.post('/api/transactions', (req, res) => {
  const { id, date, type, desc, amount, ccId, payment, notes, linkedItemId } = req.body;
  db.prepare(`INSERT INTO transactions (id,date,type,desc,amount,cc_id,payment,notes,linked_item_id)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, date, type, desc, amount, ccId, payment, notes||null, linkedItemId||null);
  res.json({ ok: true });
});

app.delete('/api/transactions/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Inventory ─────────────────────────────────────────────
app.get('/api/inventory', (_req, res) => {
  const items = db.prepare('SELECT * FROM inventory ORDER BY created_at DESC').all();
  const sales = db.prepare('SELECT * FROM inventory_sales ORDER BY sale_date ASC').all();
  res.json(items.map(i => ({
    id: i.id, type: i.type, name: i.name,
    purchaseDate: i.purchase_date, purchasePrice: i.purchase_price,
    ccId: i.cc_id, qty: i.qty, unit: i.unit,
    notes: i.notes, status: i.status,
    photoPath: i.photo_path || null,
    sellingPrice: i.selling_price ?? null,
    description: i.description || null,
    isAvailable: i.is_available !== 0,
    sales: sales.filter(s => s.inventory_id === i.id).map(s => ({
      id: s.id, saleDate: s.sale_date, salePrice: s.sale_price,
      platform: s.platform, payment: s.payment, notes: s.notes,
    })),
  })));
});

app.post('/api/inventory', (req, res) => {
  const { id, type, name, purchaseDate, purchasePrice, sellingPrice, ccId, qty, unit, notes, description, isAvailable } = req.body;
  db.prepare(`INSERT INTO inventory
    (id,type,name,purchase_date,purchase_price,selling_price,cc_id,qty,unit,notes,description,is_available)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, type, name, purchaseDate, purchasePrice, sellingPrice??null, ccId, qty||1, unit||'unidad', notes||null, description||null, isAvailable!==false?1:0);
  res.json({ ok: true });
});

app.patch('/api/inventory/:id', (req, res) => {
  const { type, name, purchaseDate, purchasePrice, sellingPrice, ccId, qty, unit, notes, description, isAvailable } = req.body;
  db.prepare(`UPDATE inventory SET type=?,name=?,purchase_date=?,purchase_price=?,selling_price=?,cc_id=?,qty=?,unit=?,notes=?,description=?,is_available=? WHERE id=?`)
    .run(type, name, purchaseDate, purchasePrice, sellingPrice??null, ccId, qty||1, unit||'unidad', notes||null, description||null, isAvailable!==false?1:0, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/inventory/:id', (req, res) => {
  const item = db.prepare('SELECT photo_path FROM inventory WHERE id=?').get(req.params.id);
  if (item?.photo_path) {
    try { fs.unlinkSync(path.join(UPL_DIR, item.photo_path)); } catch {}
  }
  db.prepare('DELETE FROM inventory WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Photo upload ──────────────────────────────────────────
app.post('/api/inventory/:itemId/photo', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image received' });
  db.prepare('UPDATE inventory SET photo_path=? WHERE id=?')
    .run(req.file.filename, req.params.itemId);
  res.json({ ok: true, photoPath: req.file.filename });
});

app.delete('/api/inventory/:itemId/photo', (req, res) => {
  const item = db.prepare('SELECT photo_path FROM inventory WHERE id=?').get(req.params.itemId);
  if (item?.photo_path) {
    try { fs.unlinkSync(path.join(UPL_DIR, item.photo_path)); } catch {}
    db.prepare('UPDATE inventory SET photo_path=NULL WHERE id=?').run(req.params.itemId);
  }
  res.json({ ok: true });
});


// ── Cost Center photo ─────────────────────────────────────
const ccUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPL_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `cc_${req.params.ccId}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

app.post('/api/cost-centers/:ccId/photo', ccUpload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image' });
  db.prepare('UPDATE cost_centers SET photo_path=? WHERE id=?')
    .run(req.file.filename, req.params.ccId);
  res.json({ ok: true, photoPath: req.file.filename });
});

app.delete('/api/cost-centers/:ccId/photo', (req, res) => {
  const row = db.prepare('SELECT photo_path FROM cost_centers WHERE id=?').get(req.params.ccId);
  if (row?.photo_path) {
    try { fs.unlinkSync(path.join(UPL_DIR, row.photo_path)); } catch {}
    db.prepare('UPDATE cost_centers SET photo_path=NULL WHERE id=?').run(req.params.ccId);
  }
  res.json({ ok: true });
});

// ── Inventory Sales / Harvests ────────────────────────────
app.post('/api/inventory/:itemId/sales', (req, res) => {
  const { id, saleDate, salePrice, platform, payment, notes } = req.body;
  const { itemId } = req.params;
  db.prepare(`INSERT INTO inventory_sales
    (id,inventory_id,sale_date,sale_price,platform,payment,notes)
    VALUES (?,?,?,?,?,?,?)`)
    .run(id, itemId, saleDate, salePrice, platform||null, payment||'Efectivo', notes||null);
  const item = db.prepare('SELECT type FROM inventory WHERE id=?').get(itemId);
  if (item && item.type !== 'plant') {
    db.prepare("UPDATE inventory SET status='sold' WHERE id=?").run(itemId);
  }
  res.json({ ok: true });
});

// ── Catch-all → React ─────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.includes('.')) return res.status(404).send('Not Found');
  if (fs.existsSync(DIST)) {
    res.sendFile(path.join(DIST, 'index.html'));
  } else {
    res.status(404).send('Run "npm run build" and restart the server.');
  }
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌿 Bloom Aquatics → http://localhost:${PORT}`);
  console.log(`   DB      : ${DB_PATH}`);
  console.log(`   Backups : ${BKP_DIR}`);
  console.log(`   Uploads : ${UPL_DIR}\n`);
});