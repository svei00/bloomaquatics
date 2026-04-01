import { useState, useEffect, useRef } from "react";

const MONTHS   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_S = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const PAYMENTS  = ['Efectivo','Zelle','Venmo','PayPal','Otro'];
const PLATFORMS = ['OfferUp','Facebook Marketplace','eBay','En persona','Otro'];
const SUPPLY_UNITS = ['unidad','botella','bolsa','galón','litro','kg','g','ml'];
const CC_COLORS    = ['#7c3aed','#d97706','#dc2626','#16a34a','#0891b2','#db2777','#059669','#9333ea'];

const fmt       = n  => `$${(+n||0).toFixed(2)}`;
const uid       = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today     = () => new Date().toISOString().slice(0,10);
const inMY      = (d,m,y) => { try{ const dt=new Date(d+'T12:00:00'); return dt.getMonth()===m&&dt.getFullYear()===y; }catch{return false;} };
const inY       = (d,y)   => { try{ return new Date(d+'T12:00:00').getFullYear()===y; }catch{return false;} };
const daysSince = d        => { try{ return Math.floor((Date.now()-new Date(d+'T12:00:00'))/86400000); }catch{return 0;} };

/* ── API ─────────────────────────────────────────────────── */
const api = {
  get:    url     => fetch(url).then(r=>r.json()),
  post:   (url,b) => fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json()),
  delete: url     => fetch(url,{method:'DELETE'}).then(r=>r.json()),
};

/* ── STYLES ──────────────────────────────────────────────── */
const S = {
  input: {
    width:'100%', boxSizing:'border-box', padding:'13px 14px',
    borderRadius:10, border:'1.5px solid #d1d5db',
    fontSize:16, background:'#ffffff', color:'#111827',
    marginBottom:12, minHeight:50, WebkitAppearance:'none', appearance:'none', outline:'none',
  },
  label: { fontSize:13, color:'#6b7280', marginBottom:5, display:'block', fontWeight:500 },
  btn: (bg='#7c3aed', fg='white') => ({
    width:'100%', padding:'16px', background:bg, color:fg, border:'none',
    borderRadius:12, fontSize:16, fontWeight:700, cursor:'pointer', minHeight:54, marginTop:8,
  }),
  card: { background:'#ffffff', border:'1px solid #e5e7eb', borderRadius:14, padding:'14px 16px', marginBottom:12 },
  muted: { fontSize:12, color:'#6b7280', lineHeight:1.7 },
};

/* ── SHARED ──────────────────────────────────────────────── */
function Avatar({ name, color, size=38 }) {
  return <div style={{ width:size, height:size, borderRadius:'50%', background:color+'25',
    border:`2px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:size*.4, fontWeight:700, color, flexShrink:0 }}>{name[0]}</div>;
}

function Chip({ label, active, onClick, color='#7c3aed' }) {
  return <button onClick={onClick} style={{
    padding:'9px 16px', borderRadius:20, flexShrink:0, whiteSpace:'nowrap', minHeight:42,
    border:`1.5px solid ${active?color:'#d1d5db'}`,
    background: active?color+'18':'transparent',
    color: active?color:'#6b7280',
    fontSize:14, fontWeight:active?700:400, cursor:'pointer' }}>{label}</button>;
}

function StatBox({ label, value, color }) {
  return <div style={{ flex:1, background:color+'12', border:`1px solid ${color}30`,
    borderRadius:10, padding:'10px 6px', textAlign:'center' }}>
    <div style={{ fontSize:10, color, marginBottom:3, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
    <div style={{ fontSize:15, fontWeight:700, color }}>{fmt(value)}</div>
  </div>;
}

/* ── MODAL ───────────────────────────────────────────────── */
/* parent must have: position:relative; overflow:hidden      */
function Modal({ title, onClose, children }) {
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{
      position:'absolute', inset:0, zIndex:400,
      background:'rgba(0,0,0,0.82)',
      display:'flex', alignItems:'flex-end',
    }}>
      <div style={{
        background:'#ffffff',          /* solid white — no CSS vars, no alpha leaks */
        width:'100%', borderRadius:'22px 22px 0 0',
        padding:'22px 20px 44px',
        maxHeight:'90vh', overflowY:'auto', boxSizing:'border-box',
        boxShadow:'0 -8px 40px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <span style={{ fontWeight:700, fontSize:19, color:'#111827' }}>{title}</span>
          <button onClick={onClose} style={{
            background:'#f3f4f6', border:'none', borderRadius:'50%',
            width:40, height:40, fontSize:22, cursor:'pointer', color:'#374151',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── HYBRID AUTOCOMPLETE ─────────────────────────────────── */
function AutoDesc({ value, onChange, inventory, placeholder }) {
  const [open, setOpen] = useState(false);
  const lower    = (value||'').toLowerCase().trim();
  const matches  = lower.length>=2
    ? inventory.filter(i=>i.name.toLowerCase().includes(lower)).slice(0,6)
    : [];
  const inCatalog = lower.length>2 && inventory.some(i=>i.name.toLowerCase()===lower);
  const showWarn  = lower.length>2 && !inCatalog && !open;

  return (
    <div style={{ position:'relative', marginBottom:12 }}>
      <input value={value} onChange={e=>{onChange(e.target.value);setOpen(true);}}
        onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),180)}
        placeholder={placeholder} style={{...S.input, marginBottom:0}}/>

      {open && matches.length>0 && (
        <div style={{ background:'#ffffff', border:'1.5px solid #7c3aed40',
          borderRadius:10, overflow:'hidden', marginTop:4,
          boxShadow:'0 4px 20px rgba(0,0,0,0.18)', zIndex:10, position:'relative' }}>
          <div style={{ padding:'6px 12px', fontSize:11, color:'#7c3aed', fontWeight:700,
            background:'#f5f3ff', borderBottom:'1px solid #ede9fe' }}>🔍 En tu catálogo:</div>
          {matches.map(item=>(
            <div key={item.id} onMouseDown={()=>{onChange(item.name);setOpen(false);}}
              style={{ padding:'11px 14px', cursor:'pointer', fontSize:14, color:'#111827',
                display:'flex', gap:10, alignItems:'center', borderBottom:'0.5px solid #f9fafb' }}>
              <span>{item.type==='plant'?'🌿':item.type==='supply'?'🧪':'📦'}</span>
              <span style={{flex:1}}>{item.name}</span>
              <span style={{fontSize:11,color:'#7c3aed',fontWeight:700}}>
                {item.type==='plant'?'Planta':item.type==='supply'?'Insumo':'Artículo'}
              </span>
            </div>
          ))}
        </div>
      )}

      {showWarn && (
        <div style={{ marginTop:5, padding:'9px 12px', background:'#fffbeb',
          border:'1px solid #f59e0b', borderRadius:8, fontSize:12, color:'#92400e',
          display:'flex', gap:6 }}>
          <span>⚠️</span>
          <span><strong>"{value}"</strong> no está en el catálogo. Agrégalo en <strong>Inventario</strong> para reportes y gráficas por artículo.</span>
        </div>
      )}
    </div>
  );
}

/* ── TRANSACTION MODAL ───────────────────────────────────── */
function TxnModal({ costCenters, inventory, onSave, onClose }) {
  const [type,setType]     = useState('income');
  const [date,setDate]     = useState(today());
  const [desc,setDesc]     = useState('');
  const [amount,setAmount] = useState('');
  const [ccId,setCcId]     = useState(costCenters[0]?.id||'');
  const [payment,setPay]   = useState('Efectivo');
  const [notes,setNotes]   = useState('');

  return (
    <Modal title="Nueva Transacción" onClose={onClose}>
      <div style={{display:'flex',gap:10,marginBottom:18}}>
        {[['income','💰 Ingreso','#16a34a'],['expense','💸 Gasto','#dc2626']].map(([t,l,c])=>(
          <button key={t} onClick={()=>{setType(t);setDesc('');}} style={{
            flex:1, padding:'13px', borderRadius:12, cursor:'pointer', minHeight:52,
            border:`2px solid ${type===t?c:'#e5e7eb'}`,
            background: type===t?c+'18':'transparent',
            color: type===t?c:'#6b7280', fontSize:15, fontWeight:700 }}>{l}</button>
        ))}
      </div>

      <label style={S.label}>Fecha</label>
      <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={S.input}/>

      <label style={S.label}>Descripción *</label>
      <AutoDesc value={desc} onChange={setDesc} inventory={inventory}
        placeholder={type==='income'?'Ej: Stroller, Java fern, plantas OfferUp…':'Ej: Seachem Flourish, sustrato, gas…'}/>

      <label style={S.label}>Monto ($) *</label>
      <input type="number" step="0.01" min="0" placeholder="0.00"
        value={amount} onChange={e=>setAmount(e.target.value)} style={S.input}/>

      <label style={S.label}>Centro de Costo</label>
      <select value={ccId} onChange={e=>setCcId(e.target.value)} style={S.input}>
        {costCenters.map(cc=><option key={cc.id} value={cc.id}>{cc.name}</option>)}
      </select>

      <label style={S.label}>Método de Pago</label>
      <select value={payment} onChange={e=>setPay(e.target.value)} style={S.input}>
        {PAYMENTS.map(p=><option key={p}>{p}</option>)}
      </select>

      <label style={S.label}>Notas (opcional)</label>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)}
        style={{...S.input,height:64,resize:'vertical'}} placeholder="Plataforma, cliente, detalles…"/>

      <button style={S.btn(type==='income'?'#16a34a':'#dc2626')} onClick={()=>{
        if(!desc||!amount) return;
        onSave({id:uid(),date,type,desc,amount:parseFloat(amount),ccId,payment,notes});
        onClose();
      }}>Guardar</button>
    </Modal>
  );
}

/* ── INVENTORY MODAL ─────────────────────────────────────── */
function InvModal({ costCenters, onSave, onClose }) {
  const [type,setType]     = useState('product');
  const [name,setName]     = useState('');
  const [pDate,setPDate]   = useState(today());
  const [pPrice,setPPrice] = useState('');
  const [ccId,setCcId]     = useState(costCenters[0]?.id||'');
  const [qty,setQty]       = useState('1');
  const [unit,setUnit]     = useState('unidad');
  const [notes,setNotes]   = useState('');

  return (
    <Modal title="Agregar al Inventario" onClose={onClose}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:18}}>
        {[['product','📦','Artículo','Para reventa'],
          ['plant',  '🌿','Planta',  'Multi-cosecha'],
          ['supply', '🧪','Insumo',  'Vitaminas, CO2…']].map(([t,ic,lb,sub])=>(
          <button key={t} onClick={()=>setType(t)} style={{
            padding:'11px 4px', borderRadius:12, textAlign:'center', cursor:'pointer',
            border:`2px solid ${type===t?'#7c3aed':'#e5e7eb'}`,
            background: type===t?'#f5f3ff':'#fafafa',
            color: type===t?'#7c3aed':'#6b7280', lineHeight:1.4 }}>
            <div style={{fontSize:22,marginBottom:4}}>{ic}</div>
            <div style={{fontSize:12,fontWeight:700,color:type===t?'#7c3aed':'#374151'}}>{lb}</div>
            <div style={{fontSize:10,marginTop:2,color:'#9ca3af'}}>{sub}</div>
          </button>
        ))}
      </div>

      <label style={S.label}>Nombre *</label>
      <input value={name} onChange={e=>setName(e.target.value)}
        placeholder={type==='plant'?'Ej: Anubias roja…':type==='supply'?'Ej: Seachem Flourish…':'Ej: Stroller Britax…'}
        style={S.input}/>

      <label style={S.label}>Fecha de Compra</label>
      <input type="date" value={pDate} onChange={e=>setPDate(e.target.value)} style={S.input}/>

      <div style={{display:'grid',gridTemplateColumns:type==='supply'?'1fr 70px 100px':'1fr',gap:10}}>
        <div>
          <label style={S.label}>Precio ($)</label>
          <input type="number" step="0.01" min="0" placeholder="0.00"
            value={pPrice} onChange={e=>setPPrice(e.target.value)} style={{...S.input,marginBottom:0}}/>
        </div>
        {type==='supply' && (<>
          <div>
            <label style={S.label}>Cant.</label>
            <input type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)} style={{...S.input,marginBottom:0}}/>
          </div>
          <div>
            <label style={S.label}>Unidad</label>
            <select value={unit} onChange={e=>setUnit(e.target.value)} style={{...S.input,marginBottom:0}}>
              {SUPPLY_UNITS.map(u=><option key={u}>{u}</option>)}
            </select>
          </div>
        </>)}
      </div>
      <div style={{height:12}}/>

      <label style={S.label}>Centro de Costo</label>
      <select value={ccId} onChange={e=>setCcId(e.target.value)} style={S.input}>
        {costCenters.map(cc=><option key={cc.id} value={cc.id}>{cc.name}</option>)}
      </select>

      <label style={S.label}>Notas</label>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)}
        style={{...S.input,height:56,resize:'vertical'}} placeholder="Opcional…"/>

      <button style={S.btn()} onClick={()=>{
        if(!name.trim()) return;
        onSave({id:uid(),type,name:name.trim(),purchaseDate:pDate,purchasePrice:parseFloat(pPrice||0),
          ccId,qty:parseFloat(qty||1),unit,notes,sales:[]});
        onClose();
      }}>Guardar</button>
    </Modal>
  );
}

/* ── SALE MODAL ──────────────────────────────────────────── */
function SaleModal({ item, onSave, onClose }) {
  const [saleDate,setSaleDate] = useState(today());
  const [salePrice,setSP]      = useState('');
  const [platform,setPlatform] = useState('OfferUp');
  const [payment,setPay]       = useState('Efectivo');
  const [notes,setNotes]       = useState('');
  const isPlant = item.type==='plant';
  const prevRev = (item.sales||[]).reduce((s,x)=>s+x.salePrice,0);

  return (
    <Modal title={isPlant?'🌿 Registrar Cosecha':'💰 Marcar Vendido'} onClose={onClose}>
      <div style={{background:'#f5f3ff',borderRadius:12,padding:'12px 16px',marginBottom:18,border:'1px solid #ddd6fe'}}>
        <div style={{fontWeight:700,fontSize:15,color:'#4c1d95'}}>{item.name}</div>
        <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>
          Comprado {item.purchaseDate} · Costo: {fmt(item.purchasePrice)}
          {isPlant&&item.sales?.length>0&&<span style={{color:'#16a34a'}}> · {item.sales.length} cosecha(s) · {fmt(prevRev)} recibido</span>}
        </div>
      </div>

      <label style={S.label}>Fecha de Venta</label>
      <input type="date" value={saleDate} onChange={e=>setSaleDate(e.target.value)} style={S.input}/>
      <label style={S.label}>Precio de Venta ($) *</label>
      <input type="number" step="0.01" min="0" placeholder="0.00" value={salePrice} onChange={e=>setSP(e.target.value)} style={S.input}/>
      <label style={S.label}>Plataforma</label>
      <select value={platform} onChange={e=>setPlatform(e.target.value)} style={S.input}>
        {PLATFORMS.map(p=><option key={p}>{p}</option>)}
      </select>
      <label style={S.label}>Método de Pago</label>
      <select value={payment} onChange={e=>setPay(e.target.value)} style={S.input}>
        {PAYMENTS.map(p=><option key={p}>{p}</option>)}
      </select>
      <label style={S.label}>Notas</label>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)}
        style={{...S.input,height:56,resize:'vertical'}} placeholder="Opcional…"/>

      <button style={S.btn('#16a34a')} onClick={()=>{
        if(!salePrice) return;
        onSave({id:uid(),saleDate,salePrice:parseFloat(salePrice),platform,payment,notes});
        onClose();
      }}>{isPlant?'Guardar Cosecha':'Guardar Venta'}</button>
    </Modal>
  );
}

/* ── SVG BAR CHART ───────────────────────────────────────── */
function BarChart({ data }) {
  const maxVal = Math.max(...data.map(d=>Math.max(d.income,d.expense)),1);
  const H=80, GW=22, BW=8, GAP=2;
  const totalW = data.length*(GW+4);
  return (
    <div style={{overflowX:'auto',marginBottom:18}}>
      <svg width={Math.max(totalW,300)} height={H+26} style={{display:'block',minWidth:'100%'}}>
        <line x1={0} y1={H} x2={totalW} y2={H} stroke="#e5e7eb" strokeWidth={1}/>
        {data.map((d,i)=>{
          const x  = i*(GW+4);
          const iH = (d.income /maxVal)*H;
          const eH = (d.expense/maxVal)*H;
          return (
            <g key={i}>
              {iH>0&&<rect x={x} y={H-iH} width={BW} height={iH} fill="#16a34a" rx={2}/>}
              {eH>0&&<rect x={x+BW+GAP} y={H-eH} width={BW} height={eH} fill="#dc2626" rx={2}/>}
              <text x={x+GW/2} y={H+16} textAnchor="middle" fontSize={8} fill="#9ca3af">{d.label}</text>
            </g>
          );
        })}
      </svg>
      <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:4}}>
        {[['#16a34a','Ingresos'],['#dc2626','Gastos']].map(([c,l])=>(
          <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#6b7280'}}>
            <div style={{width:10,height:10,borderRadius:2,background:c}}/>{l}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── DASHBOARD ───────────────────────────────────────────── */
function Dashboard({ transactions, inventory, costCenters, month, year, onMonthChange }) {
  const ccStats = ccId => {
    const txns    = transactions.filter(t=>t.ccId===ccId&&inMY(t.date,month,year));
    const items   = inventory.filter(i=>i.ccId===ccId);
    const salesInc= items.reduce((s,i)=>s+(i.sales||[]).filter(x=>inMY(x.saleDate,month,year)).reduce((ss,x)=>ss+x.salePrice,0),0);
    const purchExp= items.filter(i=>inMY(i.purchaseDate,month,year)).reduce((s,i)=>s+i.purchasePrice,0);
    const income  = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)+salesInc;
    const expense = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)+purchExp;
    return { income, expense, net:income-expense };
  };
  const stats = costCenters.map(cc=>({...cc,...ccStats(cc.id)}));
  const total  = stats.reduce((s,c)=>({income:s.income+c.income,expense:s.expense+c.expense,net:s.net+c.net}),{income:0,expense:0,net:0});
  const recent = [
    ...transactions.filter(t=>inMY(t.date,month,year)).map(t=>({
      _key:t.id,_date:t.date,_icon:t.type==='income'?'💰':'💸',
      _label:t.desc,_ccId:t.ccId,_amount:t.amount,_pos:t.type==='income',_sub:t.payment
    })),
    ...inventory.flatMap(i=>(i.sales||[]).filter(s=>inMY(s.saleDate,month,year)).map(s=>({
      _key:s.id,_date:s.saleDate,_icon:i.type==='plant'?'🌿':'📦',
      _label:`Venta: ${i.name}`,_ccId:i.ccId,_amount:s.salePrice,_pos:true,_sub:s.platform
    })))
  ].sort((a,b)=>b._date.localeCompare(a._date)).slice(0,10);

  return (
    <div>
      <div style={{background:'#7c3aed',color:'white',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 4px'}}>
        <button onClick={()=>onMonthChange(-1)} style={{background:'none',border:'none',color:'white',fontSize:34,cursor:'pointer',minWidth:58,minHeight:58,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
        <span style={{fontWeight:700,fontSize:19}}>{MONTHS[month]} {year}</span>
        <button onClick={()=>onMonthChange(1)} style={{background:'none',border:'none',color:'white',fontSize:34,cursor:'pointer',minWidth:58,minHeight:58,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
      </div>
      <div style={{padding:'16px 16px 0'}}>
        <div style={{display:'flex',gap:10,marginBottom:18}}>
          <StatBox label="Ingresos" value={total.income} color="#16a34a"/>
          <StatBox label="Gastos"   value={total.expense} color="#dc2626"/>
          <StatBox label="Neto"     value={total.net}     color={total.net>=0?'#1d4ed8':'#ea580c'}/>
        </div>
        {stats.map(cc=>(
          <div key={cc.id} style={S.card}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
              <Avatar name={cc.name} color={cc.color}/>
              <span style={{fontWeight:700,fontSize:17,color:cc.color}}>{cc.name}</span>
            </div>
            <div style={{display:'flex',gap:10}}>
              <StatBox label="Ingresos" value={cc.income} color="#16a34a"/>
              <StatBox label="Gastos"   value={cc.expense} color="#dc2626"/>
              <StatBox label="Neto"     value={cc.net}     color={cc.net>=0?'#1d4ed8':'#ea580c'}/>
            </div>
          </div>
        ))}
        <div style={{fontSize:14,fontWeight:700,color:'#6b7280',margin:'6px 0 12px'}}>Actividad reciente</div>
        {recent.length===0
          ? <div style={{textAlign:'center',padding:'36px 0',color:'#9ca3af',fontSize:15}}>Sin actividad este mes</div>
          : recent.map(item=>{
              const cc=costCenters.find(c=>c.id===item._ccId);
              return (
                <div key={item._key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid #f3f4f6'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,flex:1,minWidth:0}}>
                    <span style={{fontSize:22,flexShrink:0}}>{item._icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:500,color:'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item._label}</div>
                      <div style={S.muted}>{item._date} · <span style={{color:cc?.color}}>{cc?.name}</span> · {item._sub}</div>
                    </div>
                  </div>
                  <span style={{fontSize:15,fontWeight:700,color:item._pos?'#16a34a':'#dc2626',flexShrink:0,marginLeft:10}}>
                    {item._pos?'+':'-'}{fmt(item._amount)}
                  </span>
                </div>
              );
            })}
        <div style={{height:24}}/>
      </div>
    </div>
  );
}

/* ── TRANSACTIONS ────────────────────────────────────────── */
function Transactions({ transactions, inventory, costCenters, onAdd, onDelete }) {
  const [fCC,setFCC]     = useState('all');
  const [fType,setFType] = useState('all');
  const filtered = [...transactions].filter(t=>fCC==='all'||t.ccId===fCC).filter(t=>fType==='all'||t.type===fType).sort((a,b)=>b.date.localeCompare(a.date));
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{padding:'12px 16px',borderBottom:'1px solid #e5e7eb',background:'#fafafa',flexShrink:0}}>
        <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:10,marginBottom:4}}>
          <Chip label="Todos" active={fCC==='all'} onClick={()=>setFCC('all')}/>
          {costCenters.map(cc=><Chip key={cc.id} label={cc.name} active={fCC===cc.id} onClick={()=>setFCC(cc.id)} color={cc.color}/>)}
        </div>
        <div style={{display:'flex',gap:8}}>
          {[['all','Todos'],['income','💰 Ingresos'],['expense','💸 Gastos']].map(([v,l])=>(
            <Chip key={v} label={l} active={fType===v} onClick={()=>setFType(v)}/>
          ))}
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'10px 16px'}}>
        {filtered.length===0
          ? <div style={{textAlign:'center',padding:'52px 0',color:'#9ca3af',fontSize:15}}>No hay transacciones</div>
          : filtered.map(t=>{
              const cc=costCenters.find(c=>c.id===t.ccId);
              return (
                <div key={t.id} style={S.card}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div style={{display:'flex',gap:12,flex:1,minWidth:0}}>
                      <span style={{fontSize:24,flexShrink:0,marginTop:2}}>{t.type==='income'?'💰':'💸'}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:600,color:'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.desc}</div>
                        <div style={S.muted}>{t.date} · <span style={{color:cc?.color}}>{cc?.name}</span> · {t.payment}</div>
                        {t.notes&&<div style={{...S.muted,fontStyle:'italic'}}>{t.notes}</div>}
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0,marginLeft:8}}>
                      <span style={{fontSize:15,fontWeight:700,color:t.type==='income'?'#16a34a':'#dc2626'}}>
                        {t.type==='income'?'+':'-'}{fmt(t.amount)}
                      </span>
                      <button onClick={()=>onDelete(t.id)} style={{background:'#fef2f2',border:'none',cursor:'pointer',color:'#dc2626',fontSize:18,minWidth:38,minHeight:38,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                    </div>
                  </div>
                </div>
              );
            })}
        <div style={{height:80}}/>
      </div>
      <div style={{padding:'12px 16px',background:'#ffffff',borderTop:'1px solid #e5e7eb',flexShrink:0}}>
        <button onClick={onAdd} style={S.btn()}>+ Nueva Transacción</button>
      </div>
    </div>
  );
}

/* ── INVENTORY ───────────────────────────────────────────── */
function Inventory({ inventory, costCenters, onAdd, onSell, onDelete }) {
  const [tab,setTab]     = useState('all');
  const [fCC,setFCC]     = useState('all');
  const [saleItem,setSI] = useState(null);
  const filtered = inventory.filter(i=>tab==='all'||i.type===tab).filter(i=>fCC==='all'||i.ccId===fCC);
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{padding:'12px 16px 8px',borderBottom:'1px solid #e5e7eb',background:'#fafafa',flexShrink:0}}>
        <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:10,marginBottom:4}}>
          {[['all','🗂️ Todos'],['product','📦 Artículos'],['plant','🌿 Plantas'],['supply','🧪 Insumos']].map(([v,l])=>(
            <Chip key={v} label={l} active={tab===v} onClick={()=>setTab(v)}/>
          ))}
        </div>
        <div style={{display:'flex',gap:8,overflowX:'auto'}}>
          <Chip label="Todos" active={fCC==='all'} onClick={()=>setFCC('all')}/>
          {costCenters.map(cc=><Chip key={cc.id} label={cc.name} active={fCC===cc.id} onClick={()=>setFCC(cc.id)} color={cc.color}/>)}
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'10px 16px'}}>
        {filtered.length===0
          ? <div style={{textAlign:'center',padding:'52px 0',color:'#9ca3af',fontSize:15}}>Sin artículos</div>
          : filtered.map(item=>{
              const cc=costCenters.find(c=>c.id===item.ccId);
              const isPlant=item.type==='plant', isSupply=item.type==='supply';
              const salesCnt=item.sales?.length||0;
              const totalRev=(item.sales||[]).reduce((s,x)=>s+x.salePrice,0);
              const profit=totalRev-item.purchasePrice;
              return (
                <div key={item.id} style={S.card}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                    <div style={{display:'flex',gap:12,flex:1,minWidth:0}}>
                      <span style={{fontSize:26,flexShrink:0}}>{isSupply?'🧪':isPlant?'🌿':'📦'}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:700,color:'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
                        <div style={S.muted}>
                          {item.purchaseDate} · <span style={{color:cc?.color}}>{cc?.name}</span>
                          {!isSupply&&<span> · {daysSince(item.purchaseDate)}d en stock</span>}
                          {isSupply&&<span> · {item.qty} {item.unit}</span>}
                        </div>
                        {item.notes&&<div style={{...S.muted,fontStyle:'italic'}}>{item.notes}</div>}
                      </div>
                    </div>
                    <button onClick={()=>onDelete(item.id)} style={{background:'#fef2f2',border:'none',cursor:'pointer',color:'#dc2626',fontSize:18,minWidth:36,minHeight:36,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>×</button>
                  </div>
                  {isSupply
                    ? <div style={{background:'#fef2f2',borderRadius:10,padding:'10px 14px',display:'flex',justifyContent:'space-between'}}>
                        <span style={{fontSize:13,color:'#6b7280'}}>Gasto registrado</span>
                        <span style={{fontSize:15,fontWeight:700,color:'#dc2626'}}>{fmt(item.purchasePrice)}</span>
                      </div>
                    : <div style={{display:'flex',gap:8,marginBottom:salesCnt>0&&isPlant?12:0}}>
                        {[['Costo',fmt(item.purchasePrice),'#6b7280'],
                          ['Ventas',fmt(totalRev),'#16a34a'],
                          ['Ganancia',fmt(profit),profit>=0?'#1d4ed8':'#dc2626'],
                          [isPlant?'Cosechas':'Estado',
                            isPlant?`${salesCnt}x`:(salesCnt>0?'✓ Vendido':'Disponible'),
                            isPlant?'#7c3aed':salesCnt>0?'#16a34a':'#d97706']
                        ].map(([l,v,c])=>(
                          <div key={l} style={{flex:1,background:'#f9fafb',borderRadius:8,padding:'8px 4px',textAlign:'center'}}>
                            <div style={{fontSize:10,color:'#9ca3af',fontWeight:600,textTransform:'uppercase'}}>{l}</div>
                            <div style={{fontSize:13,fontWeight:700,color:c,marginTop:2}}>{v}</div>
                          </div>
                        ))}
                      </div>}
                  {isPlant&&salesCnt>0&&(
                    <div style={{borderTop:'1px solid #f3f4f6',paddingTop:10,marginTop:4}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#6b7280',marginBottom:6}}>Historial de cosechas:</div>
                      {item.sales.map((s,i)=>(
                        <div key={s.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#6b7280',padding:'3px 0'}}>
                          <span>#{i+1} · {s.saleDate} · {s.platform}</span>
                          <span style={{color:'#16a34a',fontWeight:700}}>{fmt(s.salePrice)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!isSupply&&(isPlant||salesCnt===0)&&(
                    <button onClick={()=>setSI(item)} style={{
                      width:'100%',marginTop:12,padding:'13px',borderRadius:10,
                      border:`1.5px solid ${isPlant?'#16a34a':'#1d4ed8'}`,
                      background:isPlant?'#f0fdf4':'#eff6ff',
                      color:isPlant?'#16a34a':'#1d4ed8',
                      fontSize:14,fontWeight:700,cursor:'pointer',minHeight:46
                    }}>{isPlant?'🌿 Registrar Cosecha':'💰 Marcar Vendido'}</button>
                  )}
                </div>
              );
            })}
        <div style={{height:80}}/>
      </div>
      <div style={{padding:'12px 16px',background:'#ffffff',borderTop:'1px solid #e5e7eb',flexShrink:0}}>
        <button onClick={onAdd} style={S.btn()}>+ Agregar Artículo / Planta / Insumo</button>
      </div>
      {saleItem&&<SaleModal item={saleItem} onSave={sale=>{onSell(saleItem.id,sale);setSI(null);}} onClose={()=>setSI(null)}/>}
    </div>
  );
}

/* ── REPORTS ─────────────────────────────────────────────── */
function Reports({ transactions, inventory, costCenters }) {
  const [year,setYear] = useState(new Date().getFullYear());
  const [fCC,setFCC]   = useState('all');
  const calcM = mi => {
    const txns    = transactions.filter(t=>inMY(t.date,mi,year)&&(fCC==='all'||t.ccId===fCC));
    const items   = inventory.filter(i=>fCC==='all'||i.ccId===fCC);
    const salesInc= items.reduce((s,i)=>s+(i.sales||[]).filter(x=>inMY(x.saleDate,mi,year)).reduce((ss,x)=>ss+x.salePrice,0),0);
    const purchExp= items.filter(i=>inMY(i.purchaseDate,mi,year)).reduce((s,i)=>s+i.purchasePrice,0);
    const income  = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)+salesInc;
    const expense = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)+purchExp;
    return { income, expense, net:income-expense, has:income>0||expense>0 };
  };
  const mData = MONTHS_S.map((m,mi)=>({label:m,...calcM(mi)}));
  const total  = mData.reduce((s,m)=>({income:s.income+m.income,expense:s.expense+m.expense,net:s.net+m.net}),{income:0,expense:0,net:0});
  const topItems = inventory.filter(i=>i.sales?.length>0&&(fCC==='all'||i.ccId===fCC))
    .map(i=>({name:i.name,type:i.type,cnt:i.sales.length,
      totalRev:(i.sales||[]).reduce((s,x)=>s+x.salePrice,0),
      profit:(i.sales||[]).reduce((s,x)=>s+x.salePrice,0)-i.purchasePrice,
      days:daysSince(i.purchaseDate)}))
    .sort((a,b)=>b.profit-a.profit).slice(0,5);
  const payMap = {};
  [...transactions.filter(t=>t.type==='income'&&inY(t.date,year)&&(fCC==='all'||t.ccId===fCC)),
   ...inventory.filter(i=>fCC==='all'||i.ccId===fCC).flatMap(i=>(i.sales||[]).filter(s=>inY(s.saleDate,year)))
  ].forEach(t=>{ const p=t.payment||'Efectivo'; payMap[p]=(payMap[p]||0)+(t.amount||t.salePrice||0); });
  const td=(al='right',c='#374151')=>({padding:'10px',textAlign:al,fontSize:13,color:c,borderBottom:'1px solid #f3f4f6'});

  return (
    <div style={{overflowY:'auto',height:'100%',boxSizing:'border-box',padding:'16px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:16,marginBottom:16}}>
        <button onClick={()=>setYear(y=>y-1)} style={{background:'none',border:'none',fontSize:32,cursor:'pointer',color:'#374151',minWidth:52,minHeight:52}}>‹</button>
        <span style={{fontWeight:700,fontSize:24,color:'#111827'}}>{year}</span>
        <button onClick={()=>setYear(y=>y+1)} style={{background:'none',border:'none',fontSize:32,cursor:'pointer',color:'#374151',minWidth:52,minHeight:52}}>›</button>
      </div>
      <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:10,marginBottom:16}}>
        <Chip label="Todos" active={fCC==='all'} onClick={()=>setFCC('all')}/>
        {costCenters.map(cc=><Chip key={cc.id} label={cc.name} active={fCC===cc.id} onClick={()=>setFCC(cc.id)} color={cc.color}/>)}
      </div>
      <div style={{display:'flex',gap:10,marginBottom:18}}>
        <StatBox label="Ingresos" value={total.income} color="#16a34a"/>
        <StatBox label="Gastos"   value={total.expense} color="#dc2626"/>
        <StatBox label="Neto"     value={total.net}     color={total.net>=0?'#1d4ed8':'#ea580c'}/>
      </div>
      <div style={{fontSize:13,fontWeight:700,color:'#6b7280',marginBottom:10}}>Ingresos vs Gastos</div>
      <BarChart data={mData}/>
      <div style={{fontSize:13,fontWeight:700,color:'#6b7280',marginBottom:8}}>Resumen Mensual</div>
      <div style={{background:'#ffffff',border:'1px solid #e5e7eb',borderRadius:12,overflow:'hidden',marginBottom:18}}>
        <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
          <thead><tr style={{background:'#f9fafb'}}>
            {['Mes','Ingresos','Gastos','Neto'].map((h,i)=>(
              <th key={h} style={{...td(i===0?'left':'right'),fontWeight:700,fontSize:10,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{mData.map((m,i)=>(
            <tr key={i} style={{opacity:m.has?1:0.3}}>
              <td style={td('left')}>{m.label}</td>
              <td style={td('right','#16a34a')}>{m.income>0?fmt(m.income):'-'}</td>
              <td style={td('right','#dc2626')}>{m.expense>0?fmt(m.expense):'-'}</td>
              <td style={td('right',m.net>0?'#1d4ed8':m.net<0?'#dc2626':'#9ca3af')}>{m.has?fmt(m.net):'-'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {Object.keys(payMap).length>0&&(<>
        <div style={{fontSize:13,fontWeight:700,color:'#6b7280',marginBottom:8}}>Ingresos por Método de Pago</div>
        <div style={{...S.card,marginBottom:18}}>
          {Object.entries(payMap).sort((a,b)=>b[1]-a[1]).map(([m,a])=>(
            <div key={m} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid #f3f4f6'}}>
              <span style={{fontSize:14,color:'#374151'}}>{m}</span>
              <span style={{fontSize:14,fontWeight:700,color:'#16a34a'}}>{fmt(a)}</span>
            </div>
          ))}
        </div>
      </>)}
      {topItems.length>0&&(<>
        <div style={{fontSize:13,fontWeight:700,color:'#6b7280',marginBottom:8}}>Mejores Artículos por Ganancia</div>
        {topItems.map((item,i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid #f3f4f6'}}>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:'#111827'}}>{item.type==='plant'?'🌿':'📦'} {item.name}</div>
              <div style={S.muted}>{item.cnt} {item.type==='plant'?'cosecha(s)':'venta(s)'} · {item.days}d</div>
            </div>
            <div style={{textAlign:'right',flexShrink:0,marginLeft:12}}>
              <div style={{fontSize:15,fontWeight:700,color:item.profit>=0?'#16a34a':'#dc2626'}}>{fmt(item.profit)}</div>
              <div style={S.muted}>{fmt(item.totalRev)} ventas</div>
            </div>
          </div>
        ))}
      </>)}
      <div style={{height:24}}/>
    </div>
  );
}

/* ── SETTINGS ────────────────────────────────────────────── */
function Settings({ costCenters, setCostCenters }) {
  const [showAdd,setShowAdd]   = useState(false);
  const [newName,setNewName]   = useState('');
  const [newColor,setNewColor] = useState(CC_COLORS[0]);

  const addCC = async () => {
    if(!newName.trim()) return;
    const cc={id:uid(),name:newName.trim(),color:newColor};
    await api.post('/api/cost-centers',cc);
    setCostCenters(p=>[...p,cc]);
    setNewName(''); setNewColor(CC_COLORS[0]); setShowAdd(false);
  };
  const removeCC = async id => {
    if(costCenters.length<=1){alert('Debe haber al menos un centro de costo.');return;}
    if(!window.confirm('¿Eliminar? Las transacciones existentes quedarán sin asignar.')) return;
    await api.delete(`/api/cost-centers/${id}`);
    setCostCenters(p=>p.filter(c=>c.id!==id));
  };

  return (
    <div style={{padding:'18px 16px',overflowY:'auto',height:'100%',boxSizing:'border-box'}}>
      <div style={{fontWeight:800,fontSize:22,color:'#111827',marginBottom:4}}>Configuración</div>
      <div style={{...S.muted,marginBottom:24}}>🌿 Bloom Aquatics · v2.0 · SQLite + Express</div>
      <div style={{fontSize:15,fontWeight:700,color:'#374151',marginBottom:14}}>Centros de Costo</div>
      {costCenters.map(cc=>(
        <div key={cc.id} style={S.card}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <Avatar name={cc.name} color={cc.color} size={52}/>
              <div>
                <div style={{fontWeight:700,fontSize:18,color:cc.color}}>{cc.name}</div>
                <div style={S.muted}>Centro de Costo</div>
              </div>
            </div>
            {costCenters.length>1&&(
              <button onClick={()=>removeCC(cc.id)} style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',borderRadius:10,padding:'10px 16px',cursor:'pointer',fontSize:14,fontWeight:600,minHeight:46}}>Eliminar</button>
            )}
          </div>
        </div>
      ))}
      {!showAdd
        ? <button onClick={()=>setShowAdd(true)} style={{width:'100%',padding:'16px',borderRadius:14,border:'2px dashed #d1d5db',background:'transparent',color:'#6b7280',fontSize:15,cursor:'pointer',minHeight:56,marginTop:4}}>+ Agregar Persona al Negocio</button>
        : <div style={{...S.card,border:'2px solid #7c3aed50',marginTop:4}}>
            <div style={{fontWeight:700,fontSize:16,color:'#111827',marginBottom:14}}>Nueva Persona</div>
            <label style={S.label}>Nombre</label>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Ej: Papá, Carlos…" style={S.input} onKeyDown={e=>e.key==='Enter'&&addCC()}/>
            <label style={S.label}>Color</label>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:18}}>
              {CC_COLORS.map(c=>(
                <button key={c} onClick={()=>setNewColor(c)} style={{width:46,height:46,borderRadius:'50%',background:c,cursor:'pointer',border:newColor===c?'3px solid #111827':'3px solid transparent',transform:newColor===c?'scale(1.18)':'scale(1)',transition:'transform 0.15s'}}/>
              ))}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setShowAdd(false);setNewName('');}} style={{flex:1,padding:'14px',borderRadius:10,background:'#f3f4f6',border:'none',color:'#374151',fontSize:15,cursor:'pointer',minHeight:50}}>Cancelar</button>
              <button onClick={addCC} style={{flex:2,padding:'14px',borderRadius:10,background:'#7c3aed',color:'white',border:'none',fontSize:15,fontWeight:700,cursor:'pointer',minHeight:50}}>Guardar</button>
            </div>
          </div>}

      <div style={{marginTop:36,background:'#f5f3ff',borderRadius:14,padding:'18px 16px',border:'1px solid #ddd6fe'}}>
        <div style={{fontWeight:700,fontSize:14,color:'#4c1d95',marginBottom:14}}>🖥️ Deployment en DietPi · Puerto 4567</div>
        {[
          ['1. Clonar / subir archivos a DietPi','git clone … (o scp)'],
          ['2. Instalar dependencias','npm install'],
          ['3. Build del cliente React','npm run build'],
          ['4. Iniciar servidor','node server.js'],
          ['5. Con PM2 para que sobreviva reinicios','pm2 start server.js --name bloom\npm2 save'],
          ['6. Nginx (apunta a puerto 4567)','proxy_pass http://localhost:4567;'],
        ].map(([step,cmd])=>(
          <div key={step} style={{marginBottom:12}}>
            <div style={{fontSize:11,color:'#7c3aed',fontWeight:700,marginBottom:3}}>{step}</div>
            <div style={{fontFamily:'monospace',fontSize:12,background:'#ede9fe',padding:'8px 12px',borderRadius:8,color:'#312e81',whiteSpace:'pre'}}>{cmd}</div>
          </div>
        ))}
        <div style={{fontSize:12,color:'#6b7280',marginTop:8,lineHeight:1.8}}>
          Puerto: <strong>4567</strong> · DB: <strong>./bloom.db</strong><br/>
          Backups: <strong>./backups/lun.db … dom.db</strong> (auto, 7 días rolling)
        </div>
      </div>
      <div style={{height:24}}/>
    </div>
  );
}

/* ── MAIN ────────────────────────────────────────────────── */
export default function App() {
  const [ready,setReady]            = useState(false);
  const [error,setError]            = useState(null);
  const [costCenters,setCostCenters]= useState([]);
  const [transactions,setTxns]      = useState([]);
  const [inventory,setInv]          = useState([]);
  const [tab,setTab]                = useState('dashboard');
  const [modal,setModal]            = useState(null);
  const now = new Date();
  const [month,setMonth] = useState(now.getMonth());
  const [year,setYear]   = useState(now.getFullYear());

  useEffect(()=>{
    Promise.all([api.get('/api/cost-centers'),api.get('/api/transactions'),api.get('/api/inventory')])
      .then(([cc,txn,inv])=>{ setCostCenters(cc); setTxns(txn); setInv(inv); setReady(true); })
      .catch(()=>setError('No se puede conectar al servidor. ¿Está corriendo node server.js?'));
  },[]);

  const changeMonth = d => { let m=month+d,y=year; if(m>11){m=0;y++;} if(m<0){m=11;y--;} setMonth(m);setYear(y); };

  const addTxn   = async t   => { setTxns(p=>[...p,t]);   await api.post('/api/transactions',t).catch(console.error); };
  const delTxn   = async id  => { setTxns(p=>p.filter(t=>t.id!==id)); await api.delete(`/api/transactions/${id}`).catch(console.error); };
  const addInv   = async i   => { setInv(p=>[...p,i]);    await api.post('/api/inventory',i).catch(console.error); };
  const sellInv  = async (itemId,sale) => {
    setInv(p=>p.map(i=>i.id===itemId?{...i,sales:[...(i.sales||[]),sale]}:i));
    await api.post(`/api/inventory/${itemId}/sales`,sale).catch(console.error);
  };
  const delInv   = async id  => { setInv(p=>p.filter(i=>i.id!==id)); await api.delete(`/api/inventory/${id}`).catch(console.error); };

  const NAV = [
    {id:'dashboard',   icon:'🏠',label:'Inicio'},
    {id:'transactions',icon:'💳',label:'Registro'},
    {id:'inventory',   icon:'📦',label:'Inventario'},
    {id:'reports',     icon:'📊',label:'Reportes'},
    {id:'settings',    icon:'⚙️',label:'Config'},
  ];

  if(error) return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:24,textAlign:'center'}}>
      <span style={{fontSize:48}}>⚠️</span>
      <div style={{fontWeight:700,fontSize:18,color:'#dc2626'}}>Error de conexión</div>
      <div style={{fontSize:14,color:'#6b7280'}}>{error}</div>
      <button onClick={()=>window.location.reload()} style={{padding:'14px 28px',borderRadius:12,background:'#7c3aed',color:'white',border:'none',fontSize:15,fontWeight:700,cursor:'pointer'}}>Reintentar</button>
    </div>
  );

  if(!ready) return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16}}>
      <span style={{fontSize:52}}>🌿</span>
      <span style={{fontSize:20,fontWeight:700,color:'#111827'}}>Bloom Aquatics</span>
      <span style={{fontSize:14,color:'#9ca3af'}}>Conectando con el servidor…</span>
    </div>
  );

  return (
    /* position:relative + overflow:hidden = modals work as absolute children */
    <div style={{height:'100vh',display:'flex',flexDirection:'column',maxWidth:480,margin:'0 auto',position:'relative',overflow:'hidden',background:'#f9fafb'}}>
      <div style={{background:'#7c3aed',color:'white',padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div>
          <div style={{fontWeight:800,fontSize:20,letterSpacing:'-0.01em'}}>🌿 Bloom Aquatics</div>
          <div style={{fontSize:12,opacity:0.8,marginTop:1}}>Centro de Costos · Familiar</div>
        </div>
        <div style={{fontSize:11,opacity:0.65,textAlign:'right',lineHeight:1.6}}>{transactions.length} txn<br/>{inventory.length} items</div>
      </div>

      <div style={{flex:1,overflowY:'auto',minHeight:0}}>
        {tab==='dashboard'    && <Dashboard    transactions={transactions} inventory={inventory} costCenters={costCenters} month={month} year={year} onMonthChange={changeMonth}/>}
        {tab==='transactions' && <Transactions transactions={transactions} inventory={inventory} costCenters={costCenters} onAdd={()=>setModal('txn')} onDelete={delTxn}/>}
        {tab==='inventory'    && <Inventory    inventory={inventory} costCenters={costCenters} onAdd={()=>setModal('inv')} onSell={sellInv} onDelete={delInv}/>}
        {tab==='reports'      && <Reports      transactions={transactions} inventory={inventory} costCenters={costCenters}/>}
        {tab==='settings'     && <Settings     costCenters={costCenters} setCostCenters={setCostCenters}/>}
      </div>

      <div style={{display:'flex',borderTop:'1px solid #e5e7eb',background:'#ffffff',flexShrink:0}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)} style={{flex:1,padding:'10px 2px 14px',background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,minHeight:62}}>
            <span style={{fontSize:22}}>{n.icon}</span>
            <span style={{fontSize:10,fontWeight:tab===n.id?800:400,color:tab===n.id?'#7c3aed':'#9ca3af'}}>{n.label}</span>
          </button>
        ))}
      </div>

      {modal==='txn'&&<TxnModal costCenters={costCenters} inventory={inventory} onSave={addTxn} onClose={()=>setModal(null)}/>}
      {modal==='inv'&&<InvModal costCenters={costCenters} onSave={addInv} onClose={()=>setModal(null)}/>}
    </div>
  );
}