// ─────────────────────────────────────────────────────────
//  Backfill: link historical transactions → inventory items
//  Fills transactions.linked_item_id by matching the free-text
//  `desc` to an inventory `name` (case/space-insensitive).
//
//  SAFE: only fills rows where linked_item_id IS NULL. Never
//  moves, copies, or deletes anything. Reversible.
//
//  Usage (from project root):
//    node scripts/backfill-linked-items.js          → dry run (report only)
//    node scripts/backfill-linked-items.js --apply  → write the links
//    node scripts/backfill-linked-items.js --undo   → clear ALL links (revert)
// ─────────────────────────────────────────────────────────
const path     = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'bloom.db');
const APPLY = process.argv.includes('--apply');
const UNDO  = process.argv.includes('--undo');

const norm = s => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

const db = new Database(DB_PATH);

if (UNDO) {
  const n = db.prepare('UPDATE transactions SET linked_item_id = NULL').run().changes;
  console.log(`↩  Reverted: cleared linked_item_id on ${n} transaction(s).`);
  process.exit(0);
}

// Build name → id map. If a name is duplicated across items, it's ambiguous.
const items = db.prepare('SELECT id, name, type FROM inventory').all();
const byName = new Map();
const ambiguous = new Set();
for (const it of items) {
  const key = norm(it.name);
  if (byName.has(key)) ambiguous.add(key);
  else byName.set(key, it);
}

const txns = db.prepare(
  "SELECT id, date, desc, amount, type, linked_item_id FROM transactions WHERE linked_item_id IS NULL"
).all();

let matched = 0, ambig = 0, unmatched = 0;
const updates = [];
const misses  = [];

for (const t of txns) {
  const key = norm(t.desc);
  if (ambiguous.has(key)) { ambig++; misses.push(`AMBIGUO  ${t.date}  "${t.desc}"  (varios items con ese nombre)`); continue; }
  const item = byName.get(key);
  if (item) { matched++; updates.push({ txId: t.id, itemId: item.id, desc: t.desc, type: item.type }); }
  else { unmatched++; misses.push(`SIN MATCH ${t.date}  "${t.desc}"  ($${t.amount})`); }
}

console.log(`\nDB: ${DB_PATH}`);
console.log(`Transacciones sin enlazar: ${txns.length}`);
console.log(`  ✔ Coinciden exacto : ${matched}`);
console.log(`  ⚠ Ambiguas         : ${ambig}`);
console.log(`  ✘ Sin coincidencia : ${unmatched}\n`);

if (misses.length) {
  console.log('Revisar manualmente:');
  for (const m of misses) console.log('   ' + m);
  console.log('');
}

if (!APPLY) {
  console.log('DRY RUN — no se escribió nada. Corre con --apply para enlazar.\n');
  process.exit(0);
}

const stmt = db.prepare('UPDATE transactions SET linked_item_id = ? WHERE id = ?');
const run = db.transaction(rows => { for (const r of rows) stmt.run(r.itemId, r.txId); });
run(updates);
console.log(`✅ Enlazadas ${updates.length} transacciones a su artículo de inventario.\n`);
