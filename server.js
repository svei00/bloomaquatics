// ─────────────────────────────────────────────────────────
//  Bloom Aquatics · Express + SQLite backend
//  Port : 4567
//  DB   : ./bloom.db  (auto-created)
//  Bkp  : ./backups/lun.db … dom.db  (7-day rolling)
// ─────────────────────────────────────────────────────────
const express  = require('express');
const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const app      = express();
const PORT     = 4567;
const DB_PATH  = path.join(__dirname, 'bloom.db');
const BKP_DIR  = path.join(__dirname, 'backups');

// ── Ensure backup folder exists inside the project ────────
if (!fs.existsSync(BKP_DIR)) fs.mkdirSync(BKP_DIR);

// ── Open / create database ────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');   // better concurrency
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS cost_centers (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#7c3aed'
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

// ── Seed default cost centers if DB is brand new ──────────
const ccCount = db.prepare('SELECT COUNT(*) AS c FROM cost_centers').get().c;
if (ccCount === 0) {
  db.prepare('INSERT INTO cost_centers (id,name,color) VALUES (?,?,?)').run('cc1','Carito','#7c3aed');
  db.prepare('INSERT INTO cost_centers (id,name,color) VALUES (?,?,?)').run('cc2','Eileencita','#d97706');
  console.log('[DB] Default cost centers created.');
}

// ── 7-day rolling backup ───────────────────────────────────
// Each weekday overwrites last week's same-day backup
// Stored in ./backups/ (inside the project)
const DAY_NAMES = ['dom','lun','mar','mie','jue','vie','sab'];

async function doBackup() {
  const dayName = DAY_NAMES[new Date().getDay()];
  const dest    = path.join(BKP_DIR, `${dayName}.db`);
  try {
    await db.backup(dest);          // proper SQLite online backup via better-sqlite3
    console.log(`[Backup] ${dayName}.db → ${dest}`);
  } catch (err) {
    console.error('[Backup] Error:', err.message);
  }
}

// Run immediately on startup, then check every hour
doBackup();
let lastBackupDay = new Date().getDay();
setInterval(() => {
  const today = new Date().getDay();
  if (today !== lastBackupDay) {
    lastBackupDay = today;
    doBackup();
  }
}, 60 * 60 * 1000);

// ── Middleware ────────────────────────────────────────────
app.use(express.json());

// Serve built React app (run "npm run build" first)
const DIST = path.join(__dirname, 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
} else {
  console.warn('[Warning] ./dist not found. Run "npm run build" then restart.');
}

// ── Cost Centers ──────────────────────────────────────────
app.get('/api/cost-centers', (_req, res) => {
  res.json(db.prepare('SELECT * FROM cost_centers ORDER BY rowid').all());
});

app.post('/api/cost-centers', (req, res) => {
  const { id, name, color } = req.body;
  db.prepare('INSERT INTO cost_centers (id,name,color) VALUES (?,?,?)').run(id, name, color);
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
    notes: r.notes, linkedItemId: r.linked_item_id
  })));
});

app.post('/api/transactions', (req, res) => {
  const { id, date, type, desc, amount, ccId, payment, notes, linkedItemId } = req.body;
  db.prepare(`
    INSERT INTO transactions (id,date,type,desc,amount,cc_id,payment,notes,linked_item_id)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(id, date, type, desc, amount, ccId, payment, notes || null, linkedItemId || null);
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
    sales: sales.filter(s => s.inventory_id === i.id).map(s => ({
      id: s.id, saleDate: s.sale_date, salePrice: s.sale_price,
      platform: s.platform, payment: s.payment, notes: s.notes
    }))
  })));
});

app.post('/api/inventory', (req, res) => {
  const { id, type, name, purchaseDate, purchasePrice, ccId, qty, unit, notes } = req.body;
  db.prepare(`
    INSERT INTO inventory (id,type,name,purchase_date,purchase_price,cc_id,qty,unit,notes)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(id, type, name, purchaseDate, purchasePrice, ccId, qty || 1, unit || 'unidad', notes || null);
  res.json({ ok: true });
});

// Register a sale or harvest for an inventory item
app.post('/api/inventory/:itemId/sales', (req, res) => {
  const { id, saleDate, salePrice, platform, payment, notes } = req.body;
  const { itemId } = req.params;
  db.prepare(`
    INSERT INTO inventory_sales (id,inventory_id,sale_date,sale_price,platform,payment,notes)
    VALUES (?,?,?,?,?,?,?)
  `).run(id, itemId, saleDate, salePrice, platform || null, payment || 'Efectivo', notes || null);
  // Mark non-plants as sold
  const item = db.prepare('SELECT type FROM inventory WHERE id=?').get(itemId);
  if (item && item.type !== 'plant') {
    db.prepare("UPDATE inventory SET status='sold' WHERE id=?").run(itemId);
  }
  res.json({ ok: true });
});

app.delete('/api/inventory/:id', (req, res) => {
  // CASCADE in schema deletes sales automatically
  db.prepare('DELETE FROM inventory WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Catch-all → React index.html ─────────────────────────
app.get('*', (req, res) => {
  if (fs.existsSync(DIST)) {
    res.sendFile(path.join(DIST, 'index.html'));
  } else {
    res.status(404).send('Run "npm run build" and restart the server.');
  }
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌿 Bloom Aquatics running → http://localhost:${PORT}`);
  console.log(`   DB      : ${DB_PATH}`);
  console.log(`   Backups : ${BKP_DIR}\n`);
});