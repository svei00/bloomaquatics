import { useState, useEffect } from "react";

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_S = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const PAYMENTS = ['Efectivo','Zelle','Otro'];
const PLATFORMS = ['OfferUp','Facebook Marketplace','eBay','En persona','Otro'];
const SK = { CC:'nb-cc', TXN:'nb-txn', INV:'nb-inv' };
const INIT_CC = [
  { id:'cc1', name:'Carito', color:'#7c3aed' },
  { id:'cc2', name:'Eileencita', color:'#d97706' }
];

const fmt = n => `$${(+n||0).toFixed(2)}`;
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const today = () => new Date().toISOString().slice(0,10);
const inMY = (d,m,y) => { const dt=new Date(d); return dt.getMonth()===m&&dt.getFullYear()===y; };
const inY = (d,y) => new Date(d).getFullYear()===y;
const daysSince = d => Math.floor((Date.now()-new Date(d))/86400000);

const stor = {
  get: async k => { try { const r=await window.storage.get(k); return r?JSON.parse(r.value):null; } catch{return null;} },
  set: async (k,v) => { try { await window.storage.set(k,JSON.stringify(v)); } catch{} }
};

/* ── STYLES ─────────────────────────────────────────────────── */
const S = {
  input: { width:'100%', boxSizing:'border-box', padding:'10px 12px', borderRadius:8,
    border:'0.5px solid var(--color-border-secondary)', fontSize:14,
    background:'var(--color-background-primary)', color:'var(--color-text-primary)', marginBottom:10 },
  label: { fontSize:12, color:'var(--color-text-secondary)', marginBottom:4, display:'block' },
  btn: (color='#7c3aed') => ({ width:'100%', padding:'13px', background:color, color:'white',
    border:'none', borderRadius:12, fontSize:15, fontWeight:500, cursor:'pointer', marginTop:6 }),
  card: { background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)',
    borderRadius:12, padding:'14px', marginBottom:10 },
  muted: { fontSize:11, color:'var(--color-text-secondary)' }
};

/* ── COMPONENTS ─────────────────────────────────────────────── */

function Avatar({ name, color, size=32 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:color+'20',
      border:`1.5px solid ${color}`, display:'flex', alignItems:'center',
      justifyContent:'center', fontSize:size*.4, fontWeight:500, color, flexShrink:0 }}>
      {name[0]}
    </div>
  );
}

function Chip({ label, active, onClick, color='#7c3aed' }) {
  return (
    <button onClick={onClick} style={{ padding:'5px 12px', borderRadius:20, flexShrink:0,
      border:`1px solid ${active ? color : 'var(--color-border-secondary)'}`,
      background: active ? color+'18' : 'transparent',
      color: active ? color : 'var(--color-text-secondary)',
      fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' }}>
      {label}
    </button>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ flex:1, background:color+'10', border:`0.5px solid ${color}30`,
      borderRadius:10, padding:'10px 6px', textAlign:'center' }}>
      <div style={{ fontSize:10, color, marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:500, color }}>{fmt(value)}</div>
    </div>
  );
}

/* ── BOTTOM SHEET (modal without fixed) ─────────────────────── */
function Sheet({ title, onClose, children }) {
  return (
    <div onClick={e => e.target===e.currentTarget && onClose()}
      style={{ position:'absolute', inset:0, zIndex:50,
        background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-end' }}>
      <div style={{ background:'var(--color-background-primary)', width:'100%',
        borderRadius:'16px 16px 0 0', padding:'20px 16px 36px',
        maxHeight:'92%', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <span style={{ fontWeight:500, fontSize:17 }}>{title}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22,
            cursor:'pointer', color:'var(--color-text-secondary)', lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── TRANSACTION MODAL ───────────────────────────────────────── */
function TxnModal({ costCenters, onSave, onClose }) {
  const [f, set] = useState({ date:today(), type:'income', desc:'', amount:'',
    ccId:costCenters[0]?.id||'', payment:'Efectivo', notes:'' });
  const s = (k,v) => set(p => ({...p,[k]:v}));

  return (
    <Sheet title="Nueva Transacción" onClose={onClose}>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        {[['income','💰 Ingreso','#16a34a'],['expense','💸 Gasto','#dc2626']].map(([t,l,c]) => (
          <button key={t} onClick={() => s('type',t)} style={{
            flex:1, padding:'9px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:500,
            border:`1.5px solid ${f.type===t ? c : 'var(--color-border-tertiary)'}`,
            background: f.type===t ? c+'15' : 'transparent',
            color: f.type===t ? c : 'var(--color-text-secondary)' }}>{l}</button>
        ))}
      </div>

      <label style={S.label}>Fecha</label>
      <input type="date" value={f.date} onChange={e=>s('date',e.target.value)} style={S.input}/>

      <label style={S.label}>Descripción *</label>
      <input placeholder="Ej: Venta stroller, Gas, Plantas OfferUp…" value={f.desc}
        onChange={e=>s('desc',e.target.value)} style={S.input}/>

      <label style={S.label}>Monto ($) *</label>
      <input type="number" step="0.01" min="0" placeholder="0.00" value={f.amount}
        onChange={e=>s('amount',e.target.value)} style={S.input}/>

      <label style={S.label}>Centro de Costo</label>
      <select value={f.ccId} onChange={e=>s('ccId',e.target.value)} style={S.input}>
        {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
      </select>

      <label style={S.label}>Método de Pago</label>
      <select value={f.payment} onChange={e=>s('payment',e.target.value)} style={S.input}>
        {PAYMENTS.map(p => <option key={p}>{p}</option>)}
      </select>

      <label style={S.label}>Notas (opcional)</label>
      <textarea value={f.notes} onChange={e=>s('notes',e.target.value)}
        style={{...S.input, height:56, resize:'none'}}
        placeholder="Plataforma, cliente, detalles…"/>

      <button style={S.btn()} onClick={() => {
        if(f.desc && f.amount) { onSave({...f, id:uid(), amount:parseFloat(f.amount)}); onClose(); }
      }}>Guardar</button>
    </Sheet>
  );
}

/* ── INVENTORY MODAL ────────────────────────────────────────── */
function InvModal({ costCenters, onSave, onClose }) {
  const [f, set] = useState({ type:'product', name:'', purchaseDate:today(),
    purchasePrice:'', ccId:costCenters[0]?.id||'', notes:'' });
  const s = (k,v) => set(p => ({...p,[k]:v}));

  return (
    <Sheet title="Agregar Artículo / Planta" onClose={onClose}>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        {[['product','📦 Artículo'],['plant','🌿 Planta']].map(([t,l]) => (
          <button key={t} onClick={()=>s('type',t)} style={{
            flex:1, padding:'9px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:500,
            border:`1.5px solid ${f.type===t ? '#7c3aed' : 'var(--color-border-tertiary)'}`,
            background: f.type===t ? '#7c3aed18' : 'transparent',
            color: f.type===t ? '#7c3aed' : 'var(--color-text-secondary)' }}>{l}</button>
        ))}
      </div>

      <label style={S.label}>Nombre *</label>
      <input value={f.name} onChange={e=>s('name',e.target.value)}
        placeholder={f.type==='plant' ? 'Ej: Anubias roja, Java fern…' : 'Ej: Stroller Britax, Car seat…'}
        style={S.input}/>

      <label style={S.label}>Fecha de Compra</label>
      <input type="date" value={f.purchaseDate} onChange={e=>s('purchaseDate',e.target.value)} style={S.input}/>

      <label style={S.label}>Precio de Compra ($)</label>
      <input type="number" step="0.01" min="0" placeholder="0.00" value={f.purchasePrice}
        onChange={e=>s('purchasePrice',e.target.value)} style={S.input}/>

      <label style={S.label}>Centro de Costo</label>
      <select value={f.ccId} onChange={e=>s('ccId',e.target.value)} style={S.input}>
        {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
      </select>

      <label style={S.label}>Notas</label>
      <textarea value={f.notes} onChange={e=>s('notes',e.target.value)}
        style={{...S.input, height:56, resize:'none'}}
        placeholder={f.type==='plant'
          ? 'Ej: Planta madre, comprada en tienda local…'
          : 'Ej: Garage sale, buen estado…'}/>

      <button style={S.btn()} onClick={() => {
        if(f.name) {
          onSave({...f, id:uid(), purchasePrice:parseFloat(f.purchasePrice||0), sales:[], status:'available'});
          onClose();
        }
      }}>Guardar</button>
    </Sheet>
  );
}

/* ── SALE MODAL ─────────────────────────────────────────────── */
function SaleModal({ item, onSave, onClose }) {
  const [f, set] = useState({ saleDate:today(), salePrice:'', platform:'OfferUp', payment:'Efectivo', notes:'' });
  const s = (k,v) => set(p => ({...p,[k]:v}));
  const isPlant = item.type==='plant';

  return (
    <Sheet title={isPlant ? '🌿 Registrar Cosecha' : '💰 Marcar Vendido'} onClose={onClose}>
      <div style={{ background:'var(--color-background-secondary)', borderRadius:8,
        padding:'10px 12px', marginBottom:12, fontSize:13, color:'var(--color-text-secondary)' }}>
        {item.name} · Comprado {item.purchaseDate} · {fmt(item.purchasePrice)}
        {isPlant && item.sales?.length > 0 &&
          <span style={{color:'#16a34a'}}> · {item.sales.length} cosecha(s) previas</span>}
      </div>

      <label style={S.label}>Fecha de Venta</label>
      <input type="date" value={f.saleDate} onChange={e=>s('saleDate',e.target.value)} style={S.input}/>

      <label style={S.label}>Precio de Venta ($) *</label>
      <input type="number" step="0.01" min="0" placeholder="0.00" value={f.salePrice}
        onChange={e=>s('salePrice',e.target.value)} style={S.input}/>

      <label style={S.label}>Plataforma</label>
      <select value={f.platform} onChange={e=>s('platform',e.target.value)} style={S.input}>
        {PLATFORMS.map(p => <option key={p}>{p}</option>)}
      </select>

      <label style={S.label}>Método de Pago</label>
      <select value={f.payment} onChange={e=>s('payment',e.target.value)} style={S.input}>
        {PAYMENTS.map(p => <option key={p}>{p}</option>)}
      </select>

      <label style={S.label}>Notas</label>
      <textarea value={f.notes} onChange={e=>s('notes',e.target.value)}
        style={{...S.input, height:48, resize:'none'}} placeholder="Opcional…"/>

      <button style={S.btn('#16a34a')} onClick={() => {
        if(f.salePrice) { onSave({...f, id:uid(), salePrice:parseFloat(f.salePrice)}); onClose(); }
      }}>Guardar Venta</button>
    </Sheet>
  );
}

/* ── DASHBOARD ──────────────────────────────────────────────── */
function Dashboard({ transactions, inventory, costCenters, month, year, onMonthChange }) {
  const calcStats = (ccId) => {
    const txns = transactions.filter(t => t.ccId===ccId && inMY(t.date,month,year));
    const myInv = inventory.filter(i => i.ccId===ccId);
    const invExp = myInv.filter(i=>inMY(i.purchaseDate,month,year)).reduce((s,i)=>s+i.purchasePrice,0);
    const invInc = myInv.reduce((s,i)=>s+(i.sales||[]).filter(sale=>inMY(sale.saleDate,month,year)).reduce((ss,sale)=>ss+sale.salePrice,0),0);
    const income = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0) + invInc;
    const expense = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0) + invExp;
    return { income, expense, net: income - expense };
  };

  const stats = costCenters.map(cc => ({ ...cc, ...calcStats(cc.id) }));
  const total = stats.reduce((s,c)=>({income:s.income+c.income,expense:s.expense+c.expense,net:s.net+c.net}),{income:0,expense:0,net:0});

  const recent = [
    ...transactions.filter(t=>inMY(t.date,month,year)).map(t=>({...t,_date:t.date,_kind:'txn'})),
    ...inventory.flatMap(i=>(i.sales||[]).filter(s=>inMY(s.saleDate,month,year)).map(s=>({...s,_date:s.saleDate,_kind:'sale',_name:i.name,_ccId:i.ccId})))
  ].sort((a,b)=>b._date.localeCompare(a._date)).slice(0,7);

  return (
    <div>
      {/* Month nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'11px 16px', background:'#7c3aed', color:'white' }}>
        <button onClick={()=>onMonthChange(-1)} style={{background:'none',border:'none',color:'white',fontSize:22,cursor:'pointer',padding:'0 8px'}}>‹</button>
        <span style={{fontWeight:500,fontSize:16}}>{MONTHS[month]} {year}</span>
        <button onClick={()=>onMonthChange(1)} style={{background:'none',border:'none',color:'white',fontSize:22,cursor:'pointer',padding:'0 8px'}}>›</button>
      </div>

      <div style={{padding:'12px 16px 0'}}>
        {/* Total row */}
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          <StatBox label="Ingresos" value={total.income} color="#16a34a"/>
          <StatBox label="Gastos" value={total.expense} color="#dc2626"/>
          <StatBox label="Neto" value={total.net} color={total.net>=0?'#1d4ed8':'#ea580c'}/>
        </div>

        {/* Cost centers */}
        <div style={{...S.muted, marginBottom:8}}>Centros de Costo</div>
        {stats.map(cc => (
          <div key={cc.id} style={S.card}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <Avatar name={cc.name} color={cc.color} size={32}/>
              <span style={{fontWeight:500,color:cc.color}}>{cc.name}</span>
            </div>
            <div style={{display:'flex',gap:8}}>
              <StatBox label="Ingresos" value={cc.income} color="#16a34a"/>
              <StatBox label="Gastos" value={cc.expense} color="#dc2626"/>
              <StatBox label="Neto" value={cc.net} color={cc.net>=0?'#1d4ed8':'#ea580c'}/>
            </div>
          </div>
        ))}

        {/* Recent */}
        <div style={{...S.muted, margin:'4px 0 8px'}}>Actividad Reciente</div>
        {recent.length===0 ? (
          <div style={{textAlign:'center',padding:'24px 0',color:'var(--color-text-secondary)',fontSize:13}}>Sin actividad este mes</div>
        ) : (
          recent.map((item,i) => {
            const cc = costCenters.find(c=>c.id===(item.ccId||item._ccId));
            const isSale = item._kind==='sale';
            const isInc = isSale || item.type==='income';
            return (
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:16}}>{isSale?'🌿':item.type==='income'?'💰':'💸'}</span>
                  <div>
                    <div style={{fontSize:13}}>{isSale ? `Venta: ${item._name}` : item.desc}</div>
                    <div style={S.muted}>{item._date} · <span style={{color:cc?.color}}>{cc?.name}</span> · {item.payment}</div>
                  </div>
                </div>
                <span style={{fontSize:13,fontWeight:500,color:isInc?'#16a34a':'#dc2626'}}>
                  {isInc?'+':'-'}{fmt(item.amount||item.salePrice)}
                </span>
              </div>
            );
          })
        )}
        <div style={{height:16}}/>
      </div>
    </div>
  );
}

/* ── TRANSACTIONS VIEW ──────────────────────────────────────── */
function Transactions({ transactions, costCenters, onAdd, onDelete }) {
  const [fCC,setFCC] = useState('all');
  const [fType,setFType] = useState('all');

  const filtered = [...transactions]
    .filter(t => fCC==='all' || t.ccId===fCC)
    .filter(t => fType==='all' || t.type===fType)
    .sort((a,b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div style={{padding:'10px 16px 8px',borderBottom:'0.5px solid var(--color-border-tertiary)',background:'var(--color-background-primary)'}}>
        <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:6}}>
          <Chip label="Todos" active={fCC==='all'} onClick={()=>setFCC('all')}/>
          {costCenters.map(cc=><Chip key={cc.id} label={cc.name} active={fCC===cc.id} onClick={()=>setFCC(cc.id)} color={cc.color}/>)}
        </div>
        <div style={{display:'flex',gap:6}}>
          {[['all','Todos'],['income','Ingresos'],['expense','Gastos']].map(([v,l])=>(
            <Chip key={v} label={l} active={fType===v} onClick={()=>setFType(v)}/>
          ))}
        </div>
      </div>

      <div style={{padding:'8px 16px'}}>
        {filtered.length===0 ? (
          <div style={{textAlign:'center',padding:'40px 0',color:'var(--color-text-secondary)',fontSize:13}}>No hay transacciones</div>
        ) : (
          filtered.map(t => {
            const cc = costCenters.find(c=>c.id===t.ccId);
            return (
              <div key={t.id} style={S.card}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div style={{display:'flex',gap:8,flex:1}}>
                    <span style={{fontSize:18,flexShrink:0}}>{t.type==='income'?'💰':'💸'}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.desc}</div>
                      <div style={S.muted}>{t.date} · <span style={{color:cc?.color}}>{cc?.name}</span> · {t.payment}</div>
                      {t.notes && <div style={{...S.muted,fontStyle:'italic'}}>{t.notes}</div>}
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0,marginLeft:8}}>
                    <span style={{fontSize:14,fontWeight:500,color:t.type==='income'?'#16a34a':'#dc2626'}}>
                      {t.type==='income'?'+':'-'}{fmt(t.amount)}
                    </span>
                    <button onClick={()=>onDelete(t.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--color-text-secondary)',fontSize:16,lineHeight:1}}>×</button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{position:'sticky',bottom:0,padding:'12px 16px',background:'var(--color-background-primary)',borderTop:'0.5px solid var(--color-border-tertiary)'}}>
        <button onClick={onAdd} style={S.btn()}>+ Nueva Transacción</button>
      </div>
    </div>
  );
}

/* ── INVENTORY VIEW ─────────────────────────────────────────── */
function Inventory({ inventory, costCenters, onAdd, onSell, onDelete }) {
  const [tab,setTab] = useState('all');
  const [saleItem,setSaleItem] = useState(null);

  const filtered = inventory.filter(i => tab==='all' || i.type===tab);

  return (
    <div>
      <div style={{padding:'10px 16px 8px',borderBottom:'0.5px solid var(--color-border-tertiary)',background:'var(--color-background-primary)'}}>
        <div style={{display:'flex',gap:6}}>
          {[['all','🗂️ Todos'],['product','📦 Artículos'],['plant','🌿 Plantas']].map(([v,l])=>(
            <Chip key={v} label={l} active={tab===v} onClick={()=>setTab(v)}/>
          ))}
        </div>
      </div>

      <div style={{padding:'8px 16px'}}>
        {filtered.length===0 ? (
          <div style={{textAlign:'center',padding:'40px 0',color:'var(--color-text-secondary)',fontSize:13}}>Sin artículos en inventario</div>
        ) : (
          filtered.map(item => {
            const cc = costCenters.find(c=>c.id===item.ccId);
            const totalRev = (item.sales||[]).reduce((s,sale)=>s+sale.salePrice,0);
            const profit = totalRev - item.purchasePrice;
            const isPlant = item.type==='plant';
            const salesCnt = item.sales?.length||0;

            return (
              <div key={item.id} style={S.card}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontSize:22}}>{isPlant?'🌿':'📦'}</span>
                    <div>
                      <div style={{fontSize:14,fontWeight:500}}>{item.name}</div>
                      <div style={S.muted}>
                        {item.purchaseDate} · <span style={{color:cc?.color}}>{cc?.name}</span> · {daysSince(item.purchaseDate)}d desde compra
                      </div>
                    </div>
                  </div>
                  <button onClick={()=>onDelete(item.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--color-text-secondary)',fontSize:16,lineHeight:1}}>×</button>
                </div>

                <div style={{display:'flex',gap:6,marginBottom:10}}>
                  {[
                    ['Compra',fmt(item.purchasePrice),'var(--color-text-secondary)'],
                    ['Ingresos',fmt(totalRev),'#16a34a'],
                    ['Ganancia',fmt(profit),profit>=0?'#1d4ed8':'#dc2626'],
                    [isPlant?'Cosechas':'Estado',isPlant?salesCnt:(salesCnt>0?'✓':'Pendiente'),isPlant?'#7c3aed':salesCnt>0?'#16a34a':'#d97706']
                  ].map(([l,v,c])=>(
                    <div key={l} style={{flex:1,background:'var(--color-background-secondary)',borderRadius:8,padding:'6px 4px',textAlign:'center'}}>
                      <div style={{...S.muted,marginBottom:2}}>{l}</div>
                      <div style={{fontSize:12,fontWeight:500,color:c}}>{v}</div>
                    </div>
                  ))}
                </div>

                {isPlant && salesCnt > 0 && (
                  <div style={{borderTop:'0.5px solid var(--color-border-tertiary)',paddingTop:8,marginBottom:8}}>
                    <div style={{...S.muted,marginBottom:4}}>Historial de cosechas:</div>
                    {item.sales.map((s,i)=>(
                      <div key={s.id} style={{display:'flex',justifyContent:'space-between',...S.muted,padding:'2px 0'}}>
                        <span>#{i+1} · {s.saleDate} · {s.platform} · {s.payment}</span>
                        <span style={{color:'#16a34a',fontWeight:500}}>{fmt(s.salePrice)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {(isPlant || salesCnt===0) && (
                  <button onClick={()=>setSaleItem(item)} style={{
                    width:'100%', padding:'9px', borderRadius:8, cursor:'pointer',
                    fontSize:13, fontWeight:500,
                    border:`1px solid ${isPlant?'#16a34a':'#1d4ed8'}`,
                    background: isPlant?'#16a34a10':'#1d4ed810',
                    color: isPlant?'#16a34a':'#1d4ed8' }}>
                    {isPlant ? '🌿 Registrar Cosecha' : '💰 Marcar Vendido'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div style={{position:'sticky',bottom:0,padding:'12px 16px',background:'var(--color-background-primary)',borderTop:'0.5px solid var(--color-border-tertiary)'}}>
        <button onClick={onAdd} style={S.btn()}>+ Agregar Artículo / Planta</button>
      </div>

      {saleItem && (
        <SaleModal item={saleItem}
          onSave={sale => { onSell(saleItem.id, sale); setSaleItem(null); }}
          onClose={() => setSaleItem(null)}/>
      )}
    </div>
  );
}

/* ── REPORTS VIEW ───────────────────────────────────────────── */
function Reports({ transactions, inventory, costCenters }) {
  const [year, setYear] = useState(new Date().getFullYear());

  const monthData = MONTHS_S.map((m,mi) => {
    const txns = transactions.filter(t => inMY(t.date,mi,year));
    const invExp = inventory.filter(i=>inMY(i.purchaseDate,mi,year)).reduce((s,i)=>s+i.purchasePrice,0);
    const invInc = inventory.reduce((s,i)=>s+(i.sales||[]).filter(sale=>inMY(sale.saleDate,mi,year)).reduce((ss,sale)=>ss+sale.salePrice,0),0);
    const income = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0) + invInc;
    const expense = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0) + invExp;
    return { m, income, expense, net:income-expense, has:income>0||expense>0 };
  });

  const total = monthData.reduce((s,m)=>({income:s.income+m.income,expense:s.expense+m.expense,net:s.net+m.net}),{income:0,expense:0,net:0});

  const ccStats = costCenters.map(cc => {
    const myTxns = transactions.filter(t=>t.ccId===cc.id&&inY(t.date,year));
    const myInv = inventory.filter(i=>i.ccId===cc.id);
    const invExp = myInv.filter(i=>inY(i.purchaseDate,year)).reduce((s,i)=>s+i.purchasePrice,0);
    const invInc = myInv.reduce((s,i)=>s+(i.sales||[]).filter(s=>inY(s.saleDate,year)).reduce((ss,sale)=>ss+sale.salePrice,0),0);
    const income = myTxns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)+invInc;
    const expense = myTxns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)+invExp;
    return {...cc, income, expense, net:income-expense};
  });

  const topItems = inventory
    .filter(i=>i.sales?.length>0)
    .map(i=>({ name:i.name, type:i.type,
      totalRev:(i.sales||[]).reduce((s,sale)=>s+sale.salePrice,0),
      profit:(i.sales||[]).reduce((s,sale)=>s+sale.salePrice,0)-i.purchasePrice,
      cnt:i.sales?.length||0, days:daysSince(i.purchaseDate) }))
    .sort((a,b)=>b.profit-a.profit).slice(0,5);

  const tdStyle = (align='right', color='var(--color-text-primary)') =>
    ({padding:'7px 10px', textAlign:align, fontSize:12, color});

  return (
    <div style={{padding:'16px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:16,marginBottom:14}}>
        <button onClick={()=>setYear(y=>y-1)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'var(--color-text-primary)'}}>‹</button>
        <span style={{fontWeight:500,fontSize:20}}>{year}</span>
        <button onClick={()=>setYear(y=>y+1)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'var(--color-text-primary)'}}>›</button>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:14}}>
        <StatBox label="Ingresos" value={total.income} color="#16a34a"/>
        <StatBox label="Gastos" value={total.expense} color="#dc2626"/>
        <StatBox label="Neto" value={total.net} color={total.net>=0?'#1d4ed8':'#ea580c'}/>
      </div>

      <div style={{...S.muted,marginBottom:8}}>Por Centro de Costo</div>
      {ccStats.map(cc=>(
        <div key={cc.id} style={S.card}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <Avatar name={cc.name} color={cc.color} size={28}/>
            <span style={{fontWeight:500,fontSize:14,color:cc.color}}>{cc.name}</span>
          </div>
          <div style={{display:'flex',gap:8}}>
            <StatBox label="Ingresos" value={cc.income} color="#16a34a"/>
            <StatBox label="Gastos" value={cc.expense} color="#dc2626"/>
            <StatBox label="Neto" value={cc.net} color={cc.net>=0?'#1d4ed8':'#ea580c'}/>
          </div>
        </div>
      ))}

      <div style={{...S.muted,margin:'8px 0'}}>Resumen Mensual</div>
      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:10,overflow:'hidden',marginBottom:14}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'var(--color-background-secondary)'}}>
              <th style={{...tdStyle('left'),'fontWeight':500,color:'var(--color-text-secondary)'}}>Mes</th>
              <th style={{...tdStyle(),'fontWeight':500,color:'#16a34a'}}>Ing.</th>
              <th style={{...tdStyle(),'fontWeight':500,color:'#dc2626'}}>Gas.</th>
              <th style={{...tdStyle(),'fontWeight':500,color:'#1d4ed8'}}>Neto</th>
            </tr>
          </thead>
          <tbody>
            {monthData.map((m,i)=>(
              <tr key={i} style={{borderTop:'0.5px solid var(--color-border-tertiary)',opacity:m.has?1:0.35}}>
                <td style={tdStyle('left','var(--color-text-primary)')}>{m.m}</td>
                <td style={tdStyle('right','#16a34a')}>{m.income>0?fmt(m.income):'-'}</td>
                <td style={tdStyle('right','#dc2626')}>{m.expense>0?fmt(m.expense):'-'}</td>
                <td style={tdStyle('right',m.net>0?'#1d4ed8':m.net<0?'#dc2626':'var(--color-text-secondary)')}>
                  {m.has?fmt(m.net):'-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {topItems.length > 0 && (
        <>
          <div style={{...S.muted,marginBottom:8}}>Mejores Artículos (por ganancia)</div>
          {topItems.map((item,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
              <div>
                <span style={{fontSize:14}}>{item.type==='plant'?'🌿':'📦'}</span>
                <span style={{marginLeft:6,fontSize:13}}>{item.name}</span>
                <div style={S.muted}>{item.cnt} {item.type==='plant'?'cosecha(s)':'venta(s)'} · {item.days}d en inventario</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:13,fontWeight:500,color:item.profit>=0?'#16a34a':'#dc2626'}}>{fmt(item.profit)}</div>
                <div style={S.muted}>{fmt(item.totalRev)} ventas</div>
              </div>
            </div>
          ))}
          <div style={{height:16}}/>
        </>
      )}
    </div>
  );
}

/* ── MAIN APP ───────────────────────────────────────────────── */
export default function App() {
  const [ready, setReady] = useState(false);
  const [costCenters, setCostCenters] = useState(INIT_CC);
  const [transactions, setTransactions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [tab, setTab] = useState('dashboard');
  const [showAddTxn, setShowAddTxn] = useState(false);
  const [showAddInv, setShowAddInv] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  useEffect(() => {
    (async () => {
      const [cc,txn,inv] = await Promise.all([stor.get(SK.CC), stor.get(SK.TXN), stor.get(SK.INV)]);
      if(cc) setCostCenters(cc);
      if(txn) setTransactions(txn);
      if(inv) setInventory(inv);
      setReady(true);
    })();
  }, []);

  useEffect(() => { if(ready) stor.set(SK.CC, costCenters); }, [costCenters, ready]);
  useEffect(() => { if(ready) stor.set(SK.TXN, transactions); }, [transactions, ready]);
  useEffect(() => { if(ready) stor.set(SK.INV, inventory); }, [inventory, ready]);

  const changeMonth = d => {
    let m=month+d, y=year;
    if(m>11){m=0;y++;} if(m<0){m=11;y--;}
    setMonth(m); setYear(y);
  };

  const NAV = [
    {id:'dashboard',icon:'🏠',label:'Inicio'},
    {id:'transactions',icon:'💳',label:'Registro'},
    {id:'inventory',icon:'📦',label:'Inventario'},
    {id:'reports',icon:'📊',label:'Reportes'},
  ];

  if(!ready) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#7c3aed',fontSize:14,flexDirection:'column',gap:8}}>
      <span style={{fontSize:32}}>💼</span>Cargando…
    </div>
  );

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column',
      maxWidth:480, margin:'0 auto', position:'relative',
      background:'var(--color-background-tertiary)' }}>

      {/* Header */}
      <div style={{ background:'#7c3aed', color:'white', padding:'12px 16px',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{fontWeight:500,fontSize:16}}>💼 Bloom Aquatics</div>
          <div style={{fontSize:11,opacity:0.75}}>Centro de Costos Familiar</div>
        </div>
        <div style={{textAlign:'right',fontSize:11,opacity:0.7}}>
          {transactions.length} transacciones<br/>{inventory.length} artículos
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{flex:1,overflowY:'auto'}}>
        {tab==='dashboard' && <Dashboard transactions={transactions} inventory={inventory} costCenters={costCenters} month={month} year={year} onMonthChange={changeMonth}/>}
        {tab==='transactions' && <Transactions transactions={transactions} costCenters={costCenters} onAdd={()=>setShowAddTxn(true)} onDelete={id=>setTransactions(p=>p.filter(t=>t.id!==id))}/>}
        {tab==='inventory' && <Inventory inventory={inventory} costCenters={costCenters} onAdd={()=>setShowAddInv(true)} onSell={(itemId,sale)=>setInventory(p=>p.map(i=>i.id===itemId?{...i,sales:[...(i.sales||[]),sale]}:i))} onDelete={id=>setInventory(p=>p.filter(i=>i.id!==id))}/>}
        {tab==='reports' && <Reports transactions={transactions} inventory={inventory} costCenters={costCenters}/>}
      </div>

      {/* Bottom nav */}
      <div style={{ display:'flex', borderTop:'0.5px solid var(--color-border-tertiary)',
        background:'var(--color-background-primary)', flexShrink:0 }}>
        {NAV.map(n => (
          <button key={n.id} onClick={()=>setTab(n.id)} style={{
            flex:1, padding:'10px 4px', background:'none', border:'none', cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <span style={{fontSize:18}}>{n.icon}</span>
            <span style={{fontSize:10, fontWeight:tab===n.id?500:400,
              color:tab===n.id?'#7c3aed':'var(--color-text-secondary)'}}>
              {n.label}
            </span>
          </button>
        ))}
      </div>

      {/* Modals */}
      {showAddTxn && <TxnModal costCenters={costCenters} onSave={txn=>setTransactions(p=>[...p,txn])} onClose={()=>setShowAddTxn(false)}/>}
      {showAddInv && <InvModal costCenters={costCenters} onSave={item=>setInventory(p=>[...p,item])} onClose={()=>setShowAddInv(false)}/>}
    </div>
  );
}
