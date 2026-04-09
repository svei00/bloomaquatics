import { useState, useEffect, useRef } from "react";

const MONTHS    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_S  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
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
const photoUrl  = p        => p ? `/uploads/${p}?t=${Date.now()}` : null;

const api = {
  get:    url     => fetch(url).then(r=>r.json()),
  post:   (url,b) => fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json()),
  patch:  (url,b) => fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json()),
  delete: url     => fetch(url,{method:'DELETE'}).then(r=>r.json()),
  upload: (url,file) => {
    const fd = new FormData();
    fd.append('photo', file);
    return fetch(url,{method:'POST',body:fd}).then(r=>r.json());
  },
};

/* ── VIEWPORT HEIGHT: dvh on mobile, vh on desktop ───────── */
const IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const VH = IS_MOBILE ? '100dvh' : '100vh';


const S = {
  input: { width:'100%', boxSizing:'border-box', padding:'13px 14px', borderRadius:10,
    border:'1.5px solid #d1d5db', fontSize:16, background:'#ffffff', color:'#111827',
    marginBottom:12, minHeight:50, WebkitAppearance:'none', appearance:'none', outline:'none' },
  label: { fontSize:13, color:'#6b7280', marginBottom:5, display:'block', fontWeight:500 },
  btn:   (bg='#7c3aed',fg='white') => ({ width:'100%', padding:'16px', background:bg, color:fg,
    border:'none', borderRadius:12, fontSize:16, fontWeight:700, cursor:'pointer', minHeight:54, marginTop:8 }),
  card:  { background:'#ffffff', border:'1px solid #e5e7eb', borderRadius:14, padding:'14px 16px', marginBottom:12 },
  muted: { fontSize:12, color:'#6b7280', lineHeight:1.7 },
};

/* ── SHARED ──────────────────────────────────────────────── */
function Avatar({ name, color, size=38 }) {
  return <div style={{ width:size, height:size, borderRadius:'50%', background:color+'25',
    border:`2px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:size*.4, fontWeight:700, color, flexShrink:0 }}>{name[0]}</div>;
}

function Chip({ label, active, onClick, color='#7c3aed' }) {
  return <button onClick={onClick} style={{ padding:'9px 16px', borderRadius:20, flexShrink:0,
    whiteSpace:'nowrap', minHeight:42, cursor:'pointer', fontSize:14, fontWeight:active?700:400,
    border:`1.5px solid ${active?color:'#d1d5db'}`,
    background: active?color+'18':'transparent', color: active?color:'#6b7280' }}>{label}</button>;
}

function StatBox({ label, value, color }) {
  return <div style={{ flex:1, background:color+'12', border:`1px solid ${color}30`,
    borderRadius:10, padding:'10px 6px', textAlign:'center' }}>
    <div style={{ fontSize:10, color, marginBottom:3, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
    <div style={{ fontSize:15, fontWeight:700, color }}>{fmt(value)}</div>
  </div>;
}

/* ── PHOTO THUMB ─────────────────────────────────────────── */
function PhotoThumb({ photoPath, type, size=56, radius=10 }) {
  const url = photoUrl(photoPath);
  return (
    <div style={{ width:size, height:size, borderRadius:radius, overflow:'hidden', flexShrink:0,
      background:'#f3f4f6', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center' }}>
      {url
        ? <img src={url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
        : <span style={{ fontSize:size*.45 }}>{type==='plant'?'🌿':type==='supply'?'🧪':'📦'}</span>}
    </div>
  );
}

/* ── PHOTO UPLOAD WIDGET ─────────────────────────────────── */
function PhotoUpload({ itemId, currentPath, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const url = photoUrl(currentPath);

  const handleFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.upload(`/api/inventory/${itemId}/photo`, file);
      if (res.ok) onUploaded(res.photoPath);
    } finally { setUploading(false); }
  };

  const handleDelete = async () => {
    await api.delete(`/api/inventory/${itemId}/photo`);
    onUploaded(null);
  };

  return (
    <div style={{ marginBottom:12 }}>
      <label style={S.label}>Foto (miniatura)</label>
      <div style={{ display:'flex', gap:12, alignItems:'center' }}>
        <div style={{ width:80, height:80, borderRadius:12, overflow:'hidden', background:'#f3f4f6',
          border:'1.5px solid #e5e7eb', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {url
            ? <img src={url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
            : <span style={{ fontSize:32 }}>📷</span>}
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
          <input ref={el=>inputRef.current=el} type="file" accept="image/*" capture="environment"
            onChange={handleFile} style={{ display:'none' }}/>
          <button onClick={()=>inputRef.current?.click()} style={{
            padding:'11px', borderRadius:10, border:'1.5px dashed #7c3aed',
            background:'#f5f3ff', color:'#7c3aed', fontSize:14, fontWeight:600, cursor:'pointer'
          }}>{uploading ? 'Subiendo…' : url ? '📷 Cambiar foto' : '📷 Agregar foto'}</button>
          {url && (
            <button onClick={handleDelete} style={{
              padding:'8px', borderRadius:8, border:'1px solid #fecaca',
              background:'#fef2f2', color:'#dc2626', fontSize:12, fontWeight:600, cursor:'pointer'
            }}>🗑️ Eliminar foto</button>
          )}
        </div>
      </div>
      <div style={{ fontSize:11, color:'#9ca3af', marginTop:5 }}>
        Toca "Agregar foto" para usar la cámara o elegir de la galería. Máx 8 MB.
      </div>
    </div>
  );
}

/* ── MODAL ───────────────────────────────────────────────── */
function Modal({ title, onClose, children }) {
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{
      position:'absolute', inset:0, zIndex:400,
      background:'rgba(0,0,0,0.75)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'0 16px',
    }}>
      <div style={{ background:'#ffffff', width:'100%', maxWidth:440, borderRadius:20,
        padding:'22px 20px 32px', maxHeight:'88dvh', overflowY:'auto', boxSizing:'border-box',
        boxShadow:'0 8px 48px rgba(0,0,0,0.45)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <span style={{ fontWeight:700, fontSize:19, color:'#111827' }}>{title}</span>
          <button onClick={onClose} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%',
            width:40, height:40, fontSize:22, cursor:'pointer', color:'#374151',
            display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
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
  const matches  = lower.length>=2 ? inventory.filter(i=>i.name.toLowerCase().includes(lower)).slice(0,6) : [];
  const inCatalog = lower.length>2 && inventory.some(i=>i.name.toLowerCase()===lower);
  const showWarn  = lower.length>2 && !inCatalog && !open;

  return (
    <div style={{ position:'relative', marginBottom:12 }}>
      <input value={value} onChange={e=>{onChange(e.target.value);setOpen(true);}}
        onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),180)}
        placeholder={placeholder} style={{...S.input, marginBottom:0}}/>
      {open && matches.length>0 && (
        <div style={{ background:'#fff', border:'1.5px solid #7c3aed40', borderRadius:10,
          overflow:'hidden', marginTop:4, boxShadow:'0 4px 20px rgba(0,0,0,0.18)', zIndex:10, position:'relative' }}>
          <div style={{ padding:'6px 12px', fontSize:11, color:'#7c3aed', fontWeight:700,
            background:'#f5f3ff', borderBottom:'1px solid #ede9fe' }}>🔍 En tu catálogo:</div>
          {matches.map(item=>(
            <div key={item.id} onMouseDown={()=>{onChange(item.name);setOpen(false);}}
              style={{ padding:'11px 14px', cursor:'pointer', fontSize:14, color:'#111827',
                display:'flex', gap:10, alignItems:'center', borderBottom:'0.5px solid #f9fafb' }}>
              <PhotoThumb photoPath={item.photoPath} type={item.type} size={32} radius={6}/>
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
          border:'1px solid #f59e0b', borderRadius:8, fontSize:12, color:'#92400e', display:'flex', gap:6 }}>
          <span>⚠️</span>
          <span><strong>"{value}"</strong> no está en el catálogo. Agrégalo en <strong>Inventario</strong> para reportes por artículo.</span>
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
            background: type===t?c+'18':'transparent', color: type===t?c:'#6b7280', fontSize:15, fontWeight:700 }}>{l}</button>
        ))}
      </div>
      <label style={S.label}>Fecha</label>
      <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={S.input}/>
      <label style={S.label}>Descripción *</label>
      <AutoDesc value={desc} onChange={setDesc} inventory={inventory}
        placeholder={type==='income'?'Ej: Stroller, Java fern, OfferUp…':'Ej: Seachem Flourish, gas…'}/>
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
      <label style={S.label}>Notas</label>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)}
        style={{...S.input,height:64,resize:'vertical'}} placeholder="Plataforma, cliente…"/>
      <button style={S.btn(type==='income'?'#16a34a':'#dc2626')} onClick={()=>{
        if(!desc||!amount) return;
        onSave({id:uid(),date,type,desc,amount:parseFloat(amount),ccId,payment,notes});
        onClose();
      }}>Guardar</button>
    </Modal>
  );
}

/* ── INVENTORY MODAL ─────────────────────────────────────── */

/* ── INVENTORY ADD MODAL ─────────────────────────────────── */

/* ── INVENTORY ADD MODAL ─────────────────────────────────── */
function InvModal({ costCenters, onSave, onClose }) {
  const SUPPLY_UNITS = ['unidad','botella','bolsa','galón','litro','kg','g','ml'];
  const [type,setType]           = useState('product');
  const [name,setName]           = useState('');
  const [pDate,setPDate]         = useState(today());
  const [pPrice,setPPrice]       = useState('');
  const [sellPrice,setSellPrice] = useState('');
  const [desc,setDesc]           = useState('');
  const [ccId,setCcId]           = useState(costCenters[0]?.id||'');
  const [qty,setQty]             = useState('1');
  const [unit,setUnit]           = useState('unidad');
  const [notes,setNotes]         = useState('');

  return (
    <Modal title="Agregar al Inventario" onClose={onClose}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
        {[['product','📦','Artículo','Para reventa'],
          ['plant',  '🌿','Planta',  'Multi-cosecha'],
          ['supply', '🧪','Insumo',  'Vitaminas, CO2…']].map(([t,ic,lb,sub])=>(
          <button key={t} onClick={()=>setType(t)} style={{
            padding:'10px 4px',borderRadius:10,textAlign:'center',cursor:'pointer',
            border:`2px solid ${type===t?'#7c3aed':'#e5e7eb'}`,
            background:type===t?'#f5f3ff':'#fafafa',color:type===t?'#7c3aed':'#6b7280',lineHeight:1.4}}>
            <div style={{fontSize:20,marginBottom:2}}>{ic}</div>
            <div style={{fontSize:11,fontWeight:700,color:type===t?'#7c3aed':'#374151'}}>{lb}</div>
            <div style={{fontSize:9,marginTop:1,color:'#9ca3af'}}>{sub}</div>
          </button>
        ))}
      </div>
      <label style={S.label}>Nombre *</label>
      <input value={name} onChange={e=>setName(e.target.value)}
        placeholder={type==='plant'?'Ej: Anubias roja…':type==='supply'?'Ej: Seachem Flourish…':'Ej: Stroller Britax…'}
        style={S.input}/>
      <label style={S.label}>Fecha de Compra</label>
      <input type="date" value={pDate} onChange={e=>setPDate(e.target.value)} style={S.input}/>
      {type!=='supply' ? (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div><label style={S.label}>Precio Costo ($)</label>
            <input type="number" step="0.01" min="0" placeholder="0.00" value={pPrice}
              onChange={e=>setPPrice(e.target.value)} style={{...S.input,marginBottom:0}}/></div>
          <div><label style={{...S.label,color:'#16a34a'}}>Precio Venta ($)</label>
            <input type="number" step="0.01" min="0" placeholder="0.00" value={sellPrice}
              onChange={e=>setSellPrice(e.target.value)} style={{...S.input,marginBottom:0,borderColor:'#86efac'}}/></div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'1fr 70px 110px',gap:8}}>
          <div><label style={S.label}>Precio ($)</label>
            <input type="number" step="0.01" min="0" placeholder="0.00" value={pPrice}
              onChange={e=>setPPrice(e.target.value)} style={{...S.input,marginBottom:0}}/></div>
          <div><label style={S.label}>Cant.</label>
            <input type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)}
              style={{...S.input,marginBottom:0}}/></div>
          <div><label style={S.label}>Unidad</label>
            <select value={unit} onChange={e=>setUnit(e.target.value)} style={{...S.input,marginBottom:0}}>
              {SUPPLY_UNITS.map(u=><option key={u}>{u}</option>)}
            </select></div>
        </div>
      )}
      <div style={{height:12}}/>
      {type!=='supply' && (<>
        <label style={{...S.label,color:'#0891b2'}}>📋 Descripción para clientes (visible en Vitrina)</label>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)}
          style={{...S.input,height:64,resize:'vertical',borderColor:'#a5f3fc'}}
          placeholder="Ej: Se vende por tallo · Por bolsa de golf · Planta madre lista para dividir · Ideal para nano tanks…"/>
      </>)}
      <label style={S.label}>Centro de Costo</label>
      <select value={ccId} onChange={e=>setCcId(e.target.value)} style={S.input}>
        {costCenters.map(cc=><option key={cc.id} value={cc.id}>{cc.name}</option>)}
      </select>
      <label style={S.label}>Notas internas</label>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)}
        style={{...S.input,height:54,resize:'vertical'}} placeholder="Opcional — solo visible en Inventario…"/>
      <button style={S.btn()} onClick={()=>{
        if(!name.trim()) return;
        onSave({id:uid(),type,name:name.trim(),purchaseDate:pDate,
          purchasePrice:parseFloat(pPrice||0),
          sellingPrice:sellPrice!==''?parseFloat(sellPrice):null,
          description:desc||null,
          ccId,qty:parseFloat(qty||1),unit,notes,sales:[],isAvailable:true});
        onClose();
      }}>Guardar</button>
    </Modal>
  );
}

/* ── SALE MODAL ──────────────────────────────────────────── */
function SaleModal({ item, onSave, onClose }) {
  const [saleDate,setSaleDate] = useState(today());
  const [salePrice,setSP]      = useState(item.sellingPrice!=null?String(item.sellingPrice):'');
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
          {item.sellingPrice!=null&&<span style={{color:'#16a34a'}}> · Precio venta: {fmt(item.sellingPrice)}</span>}
          {isPlant&&item.sales?.length>0&&<span style={{color:'#16a34a'}}> · {item.sales.length} cosecha(s) · {fmt(prevRev)} recibido</span>}
        </div>
      </div>
      <label style={S.label}>Fecha de Venta</label>
      <input type="date" value={saleDate} onChange={e=>setSaleDate(e.target.value)} style={S.input}/>
      <label style={S.label}>Precio de Venta ($) *</label>
      <input type="number" step="0.01" min="0" placeholder="0.00" value={salePrice} onChange={e=>setSP(e.target.value)} style={S.input}/>
      <label style={S.label}>Plataforma</label>
      <select value={platform} onChange={e=>setPlatform(e.target.value)} style={S.input}>
        {['OfferUp','Facebook Marketplace','eBay','En persona','Otro'].map(p=><option key={p}>{p}</option>)}
      </select>
      <label style={S.label}>Método de Pago</label>
      <select value={payment} onChange={e=>setPay(e.target.value)} style={S.input}>
        {['Efectivo','Zelle','Venmo','PayPal','Otro'].map(p=><option key={p}>{p}</option>)}
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

/* ── EDIT INVENTORY MODAL ────────────────────────────────── */
function EditInvModal({ item, costCenters, onSave, onClose }) {
  const SUPPLY_UNITS = ['unidad','botella','bolsa','galón','litro','kg','g','ml'];
  const [type,setType]           = useState(item.type);
  const [name,setName]           = useState(item.name);
  const [pDate,setPDate]         = useState(item.purchaseDate);
  const [pPrice,setPPrice]       = useState(String(item.purchasePrice));
  const [sellPrice,setSellPrice] = useState(item.sellingPrice!=null?String(item.sellingPrice):'');
  const [desc,setDesc]           = useState(item.description||'');
  const [ccId,setCcId]           = useState(item.ccId);
  const [qty,setQty]             = useState(String(item.qty||1));
  const [unit,setUnit]           = useState(item.unit||'unidad');
  const [notes,setNotes]         = useState(item.notes||'');
  const [avail,setAvail]         = useState(item.isAvailable!==false);
  return (
    <Modal title="✏️ Editar artículo" onClose={onClose}>
      <div style={{background:'#fffbeb',border:'1px solid #f59e0b',borderRadius:10,
        padding:'10px 14px',marginBottom:14,fontSize:12,color:'#92400e'}}>
        ⚠️ Puedes corregir tipo, nombre, fechas, precios y disponibilidad. Las ventas no se afectan.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
        {[['product','📦','Artículo'],['plant','🌿','Planta'],['supply','🧪','Insumo']].map(([t,ic,lb])=>(
          <button key={t} onClick={()=>setType(t)} style={{
            padding:'10px 4px',borderRadius:10,textAlign:'center',cursor:'pointer',
            border:`2px solid ${type===t?'#7c3aed':'#e5e7eb'}`,
            background:type===t?'#f5f3ff':'#fafafa',color:type===t?'#7c3aed':'#6b7280'}}>
            <div style={{fontSize:20,marginBottom:2}}>{ic}</div>
            <div style={{fontSize:11,fontWeight:700}}>{lb}</div>
          </button>
        ))}
      </div>
      <label style={S.label}>Nombre *</label>
      <input value={name} onChange={e=>setName(e.target.value)} style={S.input}/>
      <label style={S.label}>Fecha de Compra</label>
      <input type="date" value={pDate} onChange={e=>setPDate(e.target.value)} style={S.input}/>
      {type!=='supply' ? (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div><label style={S.label}>Precio Costo ($)</label>
            <input type="number" step="0.01" min="0" value={pPrice}
              onChange={e=>setPPrice(e.target.value)} style={{...S.input,marginBottom:0}}/></div>
          <div><label style={{...S.label,color:'#16a34a'}}>Precio Venta ($)</label>
            <input type="number" step="0.01" min="0" placeholder="sin definir" value={sellPrice}
              onChange={e=>setSellPrice(e.target.value)} style={{...S.input,marginBottom:0,borderColor:'#86efac'}}/></div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'1fr 70px 110px',gap:8}}>
          <div><label style={S.label}>Precio ($)</label>
            <input type="number" step="0.01" min="0" value={pPrice}
              onChange={e=>setPPrice(e.target.value)} style={{...S.input,marginBottom:0}}/></div>
          <div><label style={S.label}>Cant.</label>
            <input type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)}
              style={{...S.input,marginBottom:0}}/></div>
          <div><label style={S.label}>Unidad</label>
            <select value={unit} onChange={e=>setUnit(e.target.value)} style={{...S.input,marginBottom:0}}>
              {SUPPLY_UNITS.map(u=><option key={u}>{u}</option>)}
            </select></div>
        </div>
      )}
      <div style={{height:12}}/>
      {type!=='supply' && (<>
        <label style={{...S.label,color:'#0891b2'}}>📋 Descripción para clientes (visible en Vitrina)</label>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)}
          style={{...S.input,height:64,resize:'vertical',borderColor:'#a5f3fc'}}
          placeholder="Ej: Se vende por tallo · Por bolsa de golf · Ideal para nano tanks…"/>
      </>)}
      <label style={S.label}>Centro de Costo</label>
      <select value={ccId} onChange={e=>setCcId(e.target.value)} style={S.input}>
        {costCenters.map(cc=><option key={cc.id} value={cc.id}>{cc.name}</option>)}
      </select>
      {/* Availability toggle */}
      <label style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
        background:avail?'#f0fdf4':'#fef2f2',borderRadius:10,border:`1px solid ${avail?'#86efac':'#fecaca'}`,
        marginBottom:12,cursor:'pointer',userSelect:'none'}}>
        <input type="checkbox" checked={avail} onChange={e=>setAvail(e.target.checked)}
          style={{width:20,height:20,accentColor:avail?'#16a34a':'#dc2626',cursor:'pointer'}}/>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:avail?'#16a34a':'#dc2626'}}>
            {avail?'✅ Disponible para venta':'⛔ No disponible (planta en crecimiento)'}
          </div>
          <div style={{fontSize:11,color:'#6b7280'}}>
            {avail?'Visible a clientes en Vitrina':'Se oculta en el filtro de disponibles'}
          </div>
        </div>
      </label>
      <label style={S.label}>Notas internas</label>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)}
        style={{...S.input,height:54,resize:'vertical'}} placeholder="Opcional…"/>
      <div style={{display:'flex',gap:10}}>
        <button onClick={onClose} style={{flex:1,padding:'14px',borderRadius:12,
          background:'#f3f4f6',border:'none',color:'#374151',fontSize:15,cursor:'pointer',minHeight:50}}>
          Cancelar</button>
        <button onClick={()=>{
          if(!name.trim()) return;
          onSave(item.id,{type,name:name.trim(),purchaseDate:pDate,
            purchasePrice:parseFloat(pPrice||0),
            sellingPrice:sellPrice!==''?parseFloat(sellPrice):null,
            description:desc||null,
            ccId,qty:parseFloat(qty||1),unit,notes,isAvailable:avail});
          onClose();
        }} style={{flex:2,padding:'14px',borderRadius:12,background:'#7c3aed',
          color:'white',border:'none',fontSize:15,fontWeight:700,cursor:'pointer',minHeight:50}}>
          Guardar Cambios</button>
      </div>
    </Modal>
  );
}


/* ── VITRINA ─────────────────────────────────────────────── */
function Vitrina({ inventory, costCenters }) {
  const [viewMode,setViewMode]   = useState('grid');
  const [search,setSearch]       = useState('');
  const [showProducts,setShowP]  = useState(true);
  const [showPlants,setShowPl]   = useState(true);
  const [showSold,setShowSold]   = useState(true);
  const [availFilter,setAF]      = useState('available'); // 'available' | 'unavailable' | 'all'
  const [showCosts,setShowCosts] = useState(false);
  const [showSellPr,setShowSP]   = useState(false);
  const [showDesc,setShowDesc]   = useState(true);        // client description
  const [fCC,setFCC]             = useState('all');
  const [sortBy,setSortBy]       = useState('name');
  const [filterOpen,setFO]       = useState(false);
  const [detail,setDetail]       = useState(null);
  const [generating,setGen]      = useState(false);

  const filtered = inventory
    .filter(i => i.type !== 'supply')
    .filter(i => (i.type==='product' && showProducts)||(i.type==='plant' && showPlants))
    .filter(i => fCC==='all' || i.ccId===fCC)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))
    .filter(i => showSold || !(i.type!=='plant' && i.sales?.length>0))
    .filter(i => {
      if (availFilter==='available')   return i.isAvailable!==false;
      if (availFilter==='unavailable') return i.isAvailable===false;
      return true;
    })
    .sort((a,b) => {
      const profitOf = x => (x.sales||[]).reduce((s,v)=>s+v.salePrice,0)-x.purchasePrice;
      if (sortBy==='profit') return profitOf(b)-profitOf(a);
      if (sortBy==='days')   return daysSince(b.purchaseDate)-daysSince(a.purchaseDate);
      if (sortBy==='recent') return b.purchaseDate.localeCompare(a.purchaseDate);
      return a.name.localeCompare(b.name);
    });

  /* ── Text share ─────────────────────────────────────────── */
  const handleShareText = () => {
    const sep = '─'.repeat(26);
    const lines = filtered.map(item => {
      const rev    = (item.sales||[]).reduce((s,x)=>s+x.salePrice,0);
      const profit = rev - item.purchasePrice;
      const icon   = item.type==='plant' ? '🌿' : '📦';
      const status = item.type!=='plant' && item.sales?.length>0 ? ' ✓ Vendido' : '';
      const parts  = [];
      if (showDesc && item.description)               parts.push(item.description);
      if (showSellPr && item.sellingPrice!=null)       parts.push(`Price: ${fmt(item.sellingPrice)}`);
      if (showCosts)                                   parts.push(`Costo: ${fmt(item.purchasePrice)}  Gan: ${profit>=0?'+':''}${fmt(profit)}`);
      return `${icon} ${item.name}${status}${parts.length ? '\n   '+parts.join(' · ') : ''}`;
    }).join('\n');
    const text = `🌿 Bloom Aquatics\n${sep}\n${lines}\n${sep}\n${filtered.length} items`;
    if (navigator.share) {
      navigator.share({ title:'Bloom Aquatics', text }).catch(()=>{});
    } else {
      navigator.clipboard?.writeText(text)
        .then(()=>alert('✓ Lista copiada. Pégala en WhatsApp, OfferUp, Facebook…'))
        .catch(()=>alert(text));
    }
  };

  /* ── Canvas image generation ─────────────────────────────── */
  const ITEMS_PER_PAGE = { grid:8, list:12, detail:6 };
  const loadImg = src => new Promise(res => {
    const img = new Image(); img.crossOrigin='anonymous';
    img.onload=()=>res(img); img.onerror=()=>res(null); img.src=src;
  });
  const rr = (ctx,x,y,w,h,r) => {
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  };

  const generatePages = async () => {
    const perPage = ITEMS_PER_PAGE[viewMode]||8;
    const pages=[]; const font='system-ui,-apple-system,sans-serif';
    const HEADER=54, PAD=10, FOOTER=28;
    const totalPages = Math.ceil(filtered.length/perPage);

    for (let p=0; p<totalPages; p++) {
      const chunk = filtered.slice(p*perPage,(p+1)*perPage);
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d');

      if (viewMode==='grid') {
        const COLS=2, CELL=180, PHOTO=150;
        const extraLines = (showDesc?1:0)+(showSellPr||showCosts?1:0);
        const INFO = 32 + extraLines*16;
        const ROWS=Math.ceil(chunk.length/COLS);
        canvas.width=COLS*CELL+(COLS+1)*PAD;
        canvas.height=HEADER+ROWS*(PHOTO+INFO+PAD)+PAD+FOOTER;
        ctx.fillStyle='#f9fafb'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#7c3aed'; ctx.fillRect(0,0,canvas.width,HEADER);
        ctx.fillStyle='white'; ctx.font=`bold 18px ${font}`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('🌿 Bloom Aquatics',canvas.width/2,HEADER/2);

        for (let i=0;i<chunk.length;i++) {
          const item=chunk[i]; const col=i%COLS; const row=Math.floor(i/COLS);
          const x=PAD+col*(CELL+PAD); const y=HEADER+PAD+row*(PHOTO+INFO+PAD);
          const rev=(item.sales||[]).reduce((s,v)=>s+v.salePrice,0);
          const profit=rev-item.purchasePrice;
          const sold=item.type!=='plant'&&item.sales?.length>0;
          const harv=item.type==='plant'?item.sales?.length||0:0;
          ctx.fillStyle='#fff'; rr(ctx,x,y,CELL,PHOTO+INFO,10); ctx.fill();
          // photo
          ctx.save(); rr(ctx,x,y,CELL,PHOTO,10); ctx.clip();
          ctx.fillStyle='#f3f4f6'; ctx.fillRect(x,y,CELL,PHOTO);
          const url=photoUrl(item.photoPath);
          if(url){const img=await loadImg(url); if(img){const a=img.width/img.height;let sw=CELL,sh=PHOTO;
            if(a>CELL/PHOTO){sh=PHOTO;sw=sh*a;}else{sw=CELL;sh=sw/a;}
            ctx.drawImage(img,x+(CELL-sw)/2,y+(PHOTO-sh)/2,sw,sh);}}
          if(!url){ctx.font='52px serif';ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.fillText(item.type==='plant'?'🌿':'📦',x+CELL/2,y+PHOTO/2);}
          ctx.restore();
          // badge
          if(sold||harv>0){const bl=sold?'✓ Vendido':`${harv}x cosecha`;
            ctx.font=`bold 9px ${font}`;const bw=ctx.measureText(bl).width+12;
            ctx.fillStyle=sold?'#16a34a':'#7c3aed'; rr(ctx,x+CELL-bw-5,y+5,bw,18,9); ctx.fill();
            ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.fillText(bl,x+CELL-bw/2-5,y+14);}
          // unavailable badge
          if(item.isAvailable===false){
            ctx.font=`bold 9px ${font}`; const bl2='⛔ No disp.';
            const bw2=ctx.measureText(bl2).width+12;
            ctx.fillStyle='#6b7280'; rr(ctx,x+5,y+5,bw2,18,9); ctx.fill();
            ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.fillText(bl2,x+5+bw2/2,y+14);}
          // text lines
          const name=item.name.length>20?item.name.slice(0,19)+'…':item.name;
          ctx.fillStyle='#111827';ctx.font=`bold 12px ${font}`;
          ctx.textAlign='center';ctx.textBaseline='alphabetic';
          ctx.fillText(name,x+CELL/2,y+PHOTO+16);
          let ly=32;
          if(showDesc&&item.description){
            const d=item.description.length>24?item.description.slice(0,23)+'…':item.description;
            ctx.fillStyle='#0891b2';ctx.font=`10px ${font}`;
            ctx.fillText(d,x+CELL/2,y+PHOTO+ly); ly+=16;}
          if(showSellPr&&item.sellingPrice!=null){
            ctx.fillStyle='#16a34a';ctx.font=`bold 12px ${font}`;
            ctx.fillText(fmt(item.sellingPrice),x+CELL/2,y+PHOTO+ly); ly+=16;}
          if(showCosts){
            ctx.fillStyle=profit>=0?'#1d4ed8':'#dc2626';ctx.font=`10px ${font}`;
            ctx.fillText(`Gan: ${profit>=0?'+':''}${fmt(profit)}`,x+CELL/2,y+PHOTO+ly);}
        }
      } else if (viewMode==='list') {
        const ROW_H=showDesc?72:56;
        canvas.width=400; canvas.height=HEADER+chunk.length*ROW_H+PAD+FOOTER;
        ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#7c3aed'; ctx.fillRect(0,0,canvas.width,HEADER);
        ctx.fillStyle='white'; ctx.font=`bold 16px ${font}`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('🌿 Bloom Aquatics',canvas.width/2,HEADER/2);
        for(let i=0;i<chunk.length;i++){
          const item=chunk[i]; const y=HEADER+i*ROW_H;
          const rev=(item.sales||[]).reduce((s,v)=>s+v.salePrice,0);
          const profit=rev-item.purchasePrice;
          ctx.fillStyle=i%2===0?'#fff':'#f9fafb'; ctx.fillRect(0,y,canvas.width,ROW_H);
          ctx.strokeStyle='#f3f4f6';ctx.lineWidth=1;
          ctx.beginPath();ctx.moveTo(0,y+ROW_H);ctx.lineTo(canvas.width,y+ROW_H);ctx.stroke();
          const TSIZ=40,TX=10,TY=y+(ROW_H-TSIZ)/2;
          ctx.fillStyle='#f3f4f6'; rr(ctx,TX,TY,TSIZ,TSIZ,6); ctx.fill();
          const url=photoUrl(item.photoPath);
          if(url){const img=await loadImg(url);if(img){ctx.save();rr(ctx,TX,TY,TSIZ,TSIZ,6);ctx.clip();
            const a=img.width/img.height;let sw=TSIZ,sh=TSIZ;if(a>1){sh=TSIZ;sw=sh*a;}else{sw=TSIZ;sh=sw/a;}
            ctx.drawImage(img,TX+(TSIZ-sw)/2,TY+(TSIZ-sh)/2,sw,sh);ctx.restore();}}
          else{ctx.font='22px serif';ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.fillText(item.type==='plant'?'🌿':'📦',TX+TSIZ/2,TY+TSIZ/2);}
          const TX2=TX+TSIZ+10;
          const name=item.name.length>26?item.name.slice(0,25)+'…':item.name;
          ctx.fillStyle='#111827';ctx.font=`bold 13px ${font}`;
          ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText(name,TX2,y+20);
          if(showDesc&&item.description){
            const d=item.description.length>32?item.description.slice(0,31)+'…':item.description;
            ctx.fillStyle='#0891b2';ctx.font=`10px ${font}`;ctx.fillText(d,TX2,y+36);}
          if(item.isAvailable===false){ctx.fillStyle='#6b7280';ctx.font=`10px ${font}`;
            ctx.fillText('⛔ No disponible',TX2,y+52);}
          if(showSellPr&&item.sellingPrice!=null){
            ctx.fillStyle='#16a34a';ctx.font=`bold 13px ${font}`;
            ctx.textAlign='right';ctx.fillText(fmt(item.sellingPrice),canvas.width-10,y+20);}
          if(showCosts){
            ctx.fillStyle=profit>=0?'#1d4ed8':'#dc2626';ctx.font=`11px ${font}`;
            ctx.textAlign='right';ctx.fillText(`${profit>=0?'+':''}${fmt(profit)}`,canvas.width-10,y+(showSellPr?36:20));}
        }
      } else {
        const CARD_H=100+(showDesc?18:0)+(showCosts||showSellPr?18:0);
        const THUMB=70;
        canvas.width=400; canvas.height=HEADER+chunk.length*(CARD_H+PAD)+PAD+FOOTER;
        ctx.fillStyle='#f9fafb'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#7c3aed'; ctx.fillRect(0,0,canvas.width,HEADER);
        ctx.fillStyle='white'; ctx.font=`bold 16px ${font}`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('🌿 Bloom Aquatics',canvas.width/2,HEADER/2);
        for(let i=0;i<chunk.length;i++){
          const item=chunk[i]; const y=HEADER+PAD+i*(CARD_H+PAD);
          const rev=(item.sales||[]).reduce((s,v)=>s+v.salePrice,0);
          const profit=rev-item.purchasePrice;
          ctx.fillStyle='#fff'; rr(ctx,PAD,y,canvas.width-2*PAD,CARD_H,10); ctx.fill();
          const TX=PAD+10,TY=y+(CARD_H-THUMB)/2;
          ctx.fillStyle='#f3f4f6'; rr(ctx,TX,TY,THUMB,THUMB,8); ctx.fill();
          const url=photoUrl(item.photoPath);
          if(url){const img=await loadImg(url);if(img){ctx.save();rr(ctx,TX,TY,THUMB,THUMB,8);ctx.clip();
            const a=img.width/img.height;let sw=THUMB,sh=THUMB;if(a>1){sh=THUMB;sw=sh*a;}else{sw=THUMB;sh=sw/a;}
            ctx.drawImage(img,TX+(THUMB-sw)/2,TY+(THUMB-sh)/2,sw,sh);ctx.restore();}}
          else{ctx.font='36px serif';ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.fillText(item.type==='plant'?'🌿':'📦',TX+THUMB/2,TY+THUMB/2);}
          const TX2=TX+THUMB+12;
          const name=item.name.length>24?item.name.slice(0,23)+'…':item.name;
          ctx.fillStyle='#111827';ctx.font=`bold 14px ${font}`;
          ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText(name,TX2,y+22);
          const sold=item.type!=='plant'&&item.sales?.length>0;
          const harv=item.type==='plant'?item.sales?.length||0:0;
          let status=sold?'✓ Vendido':harv>0?`${harv}x cosecha`:item.isAvailable===false?'⛔ No disponible':'Disponible';
          ctx.fillStyle='#6b7280';ctx.font=`11px ${font}`;ctx.fillText(status,TX2,y+40);
          let lY=58;
          if(showDesc&&item.description){
            const d=item.description.length>30?item.description.slice(0,29)+'…':item.description;
            ctx.fillStyle='#0891b2';ctx.font=`11px ${font}`;ctx.fillText(d,TX2,y+lY);lY+=18;}
          if(showSellPr&&item.sellingPrice!=null){
            ctx.fillStyle='#16a34a';ctx.font=`bold 13px ${font}`;ctx.fillText(fmt(item.sellingPrice),TX2,y+lY);lY+=18;}
          if(showCosts){ctx.fillStyle=profit>=0?'#1d4ed8':'#dc2626';ctx.font=`12px ${font}`;
            ctx.fillText(`Costo:${fmt(item.purchasePrice)} Gan:${profit>=0?'+':''}${fmt(profit)}`,TX2,y+lY);}
        }
      }
      // page footer
      if(totalPages>1){ctx.fillStyle='#9ca3af';ctx.font=`11px ${font}`;
        ctx.textAlign='center';ctx.textBaseline='alphabetic';
        ctx.fillText(`Página ${p+1} de ${totalPages}`,canvas.width/2,canvas.height-8);}
      pages.push(canvas);
    }
    return pages;
  };

  const handleShareImage = async () => {
    if(!filtered.length){alert('No hay artículos para compartir.');return;}
    setGen(true);
    try {
      const pages=await generatePages();
      const files=await Promise.all(pages.map((c,i)=>new Promise(res=>
        c.toBlob(b=>res(new File([b],`bloom-${i+1}.png`,{type:'image/png'})),'image/png'))));
      if(navigator.share&&navigator.canShare?.({files})){
        await navigator.share({title:'Bloom Aquatics',files}).catch(()=>{});
      } else {
        files.forEach(f=>{const u=URL.createObjectURL(f);const a=Object.assign(document.createElement('a'),{href:u,download:f.name});a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);});
      }
    } catch(e){console.error(e);}
    setGen(false);
  };

  const vBtn = active => ({
    background:active?'#f5f3ff':'transparent',
    border:`1.5px solid ${active?'#7c3aed':'#e5e7eb'}`,
    borderRadius:8,padding:'6px 10px',cursor:'pointer',
    color:active?'#7c3aed':'#9ca3af',
    minWidth:40,minHeight:40,fontSize:19,
    display:'flex',alignItems:'center',justifyContent:'center',
  });

  const PriceTag = ({item}) => {
    const rev=((item.sales||[]).reduce((s,x)=>s+x.salePrice,0));
    const profit=rev-item.purchasePrice;
    if(!showSellPr&&!showCosts&&!showDesc) return null;
    return (
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4,alignItems:'center'}}>
        {showDesc&&item.description&&(
          <span style={{fontSize:11,color:'#0891b2',background:'#ecfeff',
            padding:'2px 7px',borderRadius:8,border:'1px solid #a5f3fc'}}>
            {item.description}
          </span>
        )}
        {showSellPr&&item.sellingPrice!=null&&(
          <span style={{fontSize:12,fontWeight:700,color:'#16a34a',
            background:'#f0fdf4',padding:'2px 8px',borderRadius:10,border:'1px solid #86efac'}}>
            {fmt(item.sellingPrice)}
          </span>
        )}
        {showCosts&&(
          <span style={{fontSize:11,color:profit>=0?'#1d4ed8':'#dc2626'}}>
            {profit>=0?'+':''}{fmt(profit)} gan
          </span>
        )}
      </div>
    );
  };

  const renderItem = item => {
    const cc=costCenters.find(c=>c.id===item.ccId);
    const url=photoUrl(item.photoPath);
    const sold=item.type!=='plant'&&item.sales?.length>0;
    const harvests=item.type==='plant'?item.sales?.length||0:0;
    const unavailable=item.isAvailable===false;

    if(viewMode==='list') return (
      <div key={item.id} onClick={()=>setDetail(item)}
        style={{display:'flex',alignItems:'center',gap:12,padding:'11px 16px',
          borderBottom:'1px solid #f3f4f6',cursor:'pointer',
          background:unavailable?'#f9fafb':'#fff',opacity:unavailable?0.7:1}}>
        <PhotoThumb photoPath={item.photoPath} type={item.type} size={46} radius={8}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{fontSize:14,fontWeight:700,color:'#111827',overflow:'hidden',
              textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
            {unavailable&&<span style={{fontSize:10,background:'#f3f4f6',color:'#6b7280',
              padding:'1px 6px',borderRadius:8,flexShrink:0}}>No disp.</span>}
          </div>
          <div style={{fontSize:11,color:cc?.color,fontWeight:600}}>
            {cc?.name}
            {sold&&<span style={{color:'#16a34a'}}> · ✓ Vendido</span>}
            {harvests>0&&<span style={{color:'#7c3aed'}}> · {harvests} cosecha{harvests>1?'s':''}</span>}
          </div>
          <PriceTag item={item}/>
        </div>
      </div>
    );

    if(viewMode==='detail') return (
      <div key={item.id} style={{...S.card,margin:'0 12px 12px',opacity:unavailable?0.75:1}}>
        <div style={{display:'flex',gap:12,marginBottom:8}}>
          <div onClick={()=>setDetail(item)} style={{cursor:'pointer',flexShrink:0}}>
            <PhotoThumb photoPath={item.photoPath} type={item.type} size={72} radius={12}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
              <div style={{fontSize:15,fontWeight:700,color:'#111827',overflow:'hidden',
                textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
              {unavailable&&<span style={{fontSize:10,background:'#f3f4f6',color:'#6b7280',
                padding:'1px 6px',borderRadius:8,flexShrink:0}}>No disp.</span>}
            </div>
            <div style={{fontSize:11,color:cc?.color,fontWeight:600,marginBottom:4}}>{cc?.name}</div>
            <PriceTag item={item}/>
          </div>
        </div>
        {item.notes&&<div style={{fontSize:12,color:'#6b7280',fontStyle:'italic',
          padding:'6px 10px',background:'#f9fafb',borderRadius:8,marginTop:4}}>{item.notes}</div>}
      </div>
    );

    // grid
    return (
      <div key={item.id} onClick={()=>setDetail(item)}
        style={{background:'#fff',borderRadius:14,overflow:'hidden',cursor:'pointer',
          border:`1.5px solid ${sold?'#d1fae5':unavailable?'#e5e7eb':'#e5e7eb'}`,
          boxShadow:'0 1px 4px rgba(0,0,0,0.06)',position:'relative',
          opacity:unavailable?0.72:1}}>
        {sold&&<div style={{position:'absolute',top:8,right:8,zIndex:2,background:'#16a34a',
          color:'white',fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:20}}>✓ Vendido</div>}
        {harvests>0&&<div style={{position:'absolute',top:8,right:8,zIndex:2,background:'#7c3aed',
          color:'white',fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:20}}>
          {harvests} cosecha{harvests>1?'s':''}</div>}
        {unavailable&&<div style={{position:'absolute',top:8,left:8,zIndex:2,background:'#6b7280',
          color:'white',fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:20}}>No disp.</div>}
        <div style={{width:'100%',paddingTop:'100%',position:'relative',background:'#f3f4f6'}}>
          {url
            ?<img src={url} alt={item.name} style={{position:'absolute',inset:0,
                width:'100%',height:'100%',objectFit:'cover'}}/>
            :<div style={{position:'absolute',inset:0,display:'flex',
                alignItems:'center',justifyContent:'center',fontSize:48}}>
                {item.type==='plant'?'🌿':'📦'}
              </div>}
        </div>
        <div style={{padding:'10px 10px 12px'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#111827',overflow:'hidden',
            textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:2}}>{item.name}</div>
          <div style={{fontSize:11,color:cc?.color,fontWeight:600}}>{cc?.name}</div>
          <PriceTag item={item}/>
        </div>
      </div>
    );
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>

      {/* Toolbar */}
      <div style={{padding:'10px 12px',borderBottom:'1px solid #e5e7eb',
        background:'#fafafa',flexShrink:0}}>
        {/* Row 1: view + search + share */}
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <button style={vBtn(viewMode==='grid')}   title="Cuadrícula" onClick={()=>setViewMode('grid')}>⊞</button>
          <button style={vBtn(viewMode==='list')}   title="Lista"      onClick={()=>setViewMode('list')}>☰</button>
          <button style={vBtn(viewMode==='detail')} title="Detalle"    onClick={()=>setViewMode('detail')}>≡</button>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 Buscar…"
            style={{...S.input,flex:1,marginBottom:0,minHeight:40,padding:'8px 12px',fontSize:14}}/>
          <button onClick={handleShareText} title="Compartir texto"
            style={{background:'#7c3aed',border:'none',borderRadius:10,padding:'8px 10px',
              cursor:'pointer',color:'white',fontSize:15,minHeight:40,flexShrink:0,
              display:'flex',alignItems:'center',justifyContent:'center'}}>📋</button>
          <button onClick={handleShareImage} disabled={generating}
            title={`Imagen — ${viewMode}, paginado`}
            style={{background:generating?'#9ca3af':'#16a34a',border:'none',borderRadius:10,
              padding:'8px 10px',cursor:generating?'wait':'pointer',color:'white',fontSize:15,
              minHeight:40,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
            {generating?'⏳':'🖼️'}</button>
        </div>

        {/* Row 2: collapsible filters */}
        <button onClick={()=>setFO(o=>!o)}
          style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
            background:'none',border:'none',cursor:'pointer',padding:'4px 0',color:'#6b7280',fontSize:13}}>
          <span style={{fontWeight:600}}>
            Filtros · {filtered.length} artículo{filtered.length!==1?'s':''}
            {(showCosts||showSellPr||showDesc)&&<span style={{color:'#f59e0b',marginLeft:6}}>· info visible</span>}
          </span>
          <span style={{fontSize:18,display:'inline-block',transition:'transform 0.2s',
            transform:filterOpen?'rotate(180deg)':'rotate(0deg)'}}>⌄</span>
        </button>

        {filterOpen&&(
          <div style={{paddingTop:10,display:'flex',flexDirection:'column',gap:10,
            borderTop:'1px solid #e5e7eb',marginTop:6}}>

            {/* What to show to clients */}
            <div style={{background:'#fffbeb',border:'1px solid #f59e0b',borderRadius:8,
              padding:'8px 10px',display:'flex',flexDirection:'column',gap:6}}>
              <div style={{fontSize:11,fontWeight:700,color:'#92400e',marginBottom:2}}>
                MOSTRAR EN VITRINA / COMPARTIR
              </div>
              {[
                [showDesc,    setShowDesc,  '📋','Descripción del producto (para clientes)','#0891b2'],
                [showSellPr,  setShowSP,    '💚','Price / Precio de venta (para clientes)','#16a34a'],
                [showCosts,   setShowCosts, '🔒','Costo + Ganancia (interno)','#f59e0b'],
              ].map(([checked,setter,ic,label,ac],i)=>(
                <label key={i} style={{display:'flex',alignItems:'center',gap:6,
                  fontSize:13,color:'#374151',cursor:'pointer',userSelect:'none'}}>
                  <input type="checkbox" checked={checked} onChange={e=>setter(e.target.checked)}
                    style={{width:18,height:18,accentColor:ac,cursor:'pointer'}}/>
                  <span>{ic} {label}</span>
                </label>
              ))}
            </div>

            {/* Availability filter */}
            <div style={{display:'flex',gap:6}}>
              {[['available','✅ Disponibles'],['unavailable','⛔ No disp.'],['all','🗂️ Todos']].map(([v,l])=>(
                <button key={v} onClick={()=>setAF(v)} style={{
                  flex:1,padding:'8px 4px',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:600,
                  border:`1.5px solid ${availFilter===v?'#7c3aed':'#e5e7eb'}`,
                  background:availFilter===v?'#f5f3ff':'transparent',
                  color:availFilter===v?'#7c3aed':'#6b7280'}}>
                  {l}
                </button>
              ))}
            </div>

            {/* Type + sold */}
            <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
              {[[showProducts,setShowP,'📦 Artículos'],[showPlants,setShowPl,'🌿 Plantas'],
                [showSold,setShowSold,'✓ Vendidos']].map(([checked,setter,label],i)=>(
                <label key={i} style={{display:'flex',alignItems:'center',gap:6,
                  fontSize:13,color:'#374151',cursor:'pointer',userSelect:'none'}}>
                  <input type="checkbox" checked={checked} onChange={e=>setter(e.target.checked)}
                    style={{width:18,height:18,accentColor:'#7c3aed',cursor:'pointer'}}/>
                  {label}
                </label>
              ))}
            </div>

            {/* Person + sort */}
            <div style={{display:'flex',gap:8}}>
              <select value={fCC} onChange={e=>setFCC(e.target.value)}
                style={{...S.input,flex:1,marginBottom:0,minHeight:40,padding:'8px 10px',fontSize:13}}>
                <option value="all">Todas las personas</option>
                {costCenters.map(cc=><option key={cc.id} value={cc.id}>{cc.name}</option>)}
              </select>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
                style={{...S.input,flex:1,marginBottom:0,minHeight:40,padding:'8px 10px',fontSize:13}}>
                <option value="name">A–Z Nombre</option>
                <option value="profit">Mayor ganancia</option>
                <option value="days">Más tiempo en stock</option>
                <option value="recent">Más reciente</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Items */}
      <div style={{flex:1,overflowY:'auto'}}>
        {filtered.length===0
          ?<div style={{textAlign:'center',padding:'52px 16px',color:'#9ca3af'}}>
              <div style={{fontSize:52,marginBottom:12}}>🏪</div>
              <div style={{fontSize:16,fontWeight:600,color:'#374151',marginBottom:6}}>Sin resultados</div>
              <div style={{fontSize:13}}>Cambia los filtros o la búsqueda</div>
            </div>
          :viewMode==='grid'
            ?<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:12}}>
                {filtered.map(renderItem)}
              </div>
            :viewMode==='list'
            ?<div style={{background:'#fff'}}>{filtered.map(renderItem)}</div>
            :<div style={{paddingTop:12}}>{filtered.map(renderItem)}</div>
        }
        <div style={{height:24}}/>
      </div>

      {detail&&<DetailModal item={detail} costCenters={costCenters} onClose={()=>setDetail(null)}/>}
    </div>
  );
}


/* ── REPORTS ─────────────────────────────────────────────── */
function Reports({ transactions, inventory, costCenters }) {
  const [year,setYear]   = useState(new Date().getFullYear());
  const [fCC,setFCC]     = useState('all');
  const [rTab,setRTab]   = useState('monthly'); // 'monthly' | 'performers'

  const calcM = mi => {
    const txns    = transactions.filter(t=>inMY(t.date,mi,year)&&(fCC==='all'||t.ccId===fCC));
    const items   = inventory.filter(i=>fCC==='all'||i.ccId===fCC);
    const salesInc= items.reduce((s,i)=>s+(i.sales||[]).filter(x=>inMY(x.saleDate,mi,year)).reduce((ss,x)=>ss+x.salePrice,0),0);
    const purchExp= items.filter(i=>inMY(i.purchaseDate,mi,year)).reduce((s,i)=>s+i.purchasePrice,0);
    const income  = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)+salesInc;
    const expense = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)+purchExp;
    return { income, expense, net:income-expense, has:income>0||expense>0 };
  };

  const MONTHS_S2 = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const mData = MONTHS_S2.map((m,mi)=>({label:m,...calcM(mi)}));
  const total  = mData.reduce((s,m)=>({income:s.income+m.income,expense:s.expense+m.expense,net:s.net+m.net}),{income:0,expense:0,net:0});

  // Best performer analysis
  const performers = inventory
    .filter(i=>i.type!=='supply'&&(fCC==='all'||i.ccId===fCC))
    .map(i=>{
      const rev      = (i.sales||[]).reduce((s,x)=>s+x.salePrice,0);
      const profit   = rev - i.purchasePrice;
      const roi      = i.purchasePrice>0 ? (profit/i.purchasePrice)*100 : null;
      const days     = daysSince(i.purchaseDate);
      const salesCnt = i.sales?.length||0;
      const avgSale  = salesCnt>0 ? rev/salesCnt : 0;
      const profPerDay = days>0&&profit>0 ? profit/days : 0;
      return { id:i.id, name:i.name, type:i.type, purchasePrice:i.purchasePrice,
               rev, profit, roi, days, salesCnt, avgSale, profPerDay,
               cc:costCenters.find(c=>c.id===i.ccId) };
    })
    .filter(x=>x.salesCnt>0)
    .sort((a,b)=>b.profit-a.profit);

  const payMap = {};
  [...transactions.filter(t=>t.type==='income'&&inY(t.date,year)&&(fCC==='all'||t.ccId===fCC)),
   ...inventory.filter(i=>fCC==='all'||i.ccId===fCC).flatMap(i=>(i.sales||[]).filter(s=>inY(s.saleDate,year)))
  ].forEach(t=>{ const p=t.payment||'Efectivo'; payMap[p]=(payMap[p]||0)+(t.amount||t.salePrice||0); });

  const td=(al='right',c='#374151')=>({padding:'9px',textAlign:al,fontSize:12,color:c,borderBottom:'1px solid #f3f4f6'});

  return (
    <div style={{overflowY:'auto',height:'100%',boxSizing:'border-box',padding:'16px'}}>
      {/* Year picker */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:16,marginBottom:14}}>
        <button onClick={()=>setYear(y=>y-1)} style={{background:'none',border:'none',fontSize:30,cursor:'pointer',color:'#374151',minWidth:48,minHeight:48}}>‹</button>
        <span style={{fontWeight:700,fontSize:22,color:'#111827'}}>{year}</span>
        <button onClick={()=>setYear(y=>y+1)} style={{background:'none',border:'none',fontSize:30,cursor:'pointer',color:'#374151',minWidth:48,minHeight:48}}>›</button>
      </div>
      {/* CC filter */}
      <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:10,marginBottom:14}}>
        <Chip label="Todos" active={fCC==='all'} onClick={()=>setFCC('all')}/>
        {costCenters.map(cc=><Chip key={cc.id} label={cc.name} active={fCC===cc.id} onClick={()=>setFCC(cc.id)} color={cc.color}/>)}
      </div>
      {/* Tab toggle */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {[['monthly','📅 Mensual'],['performers','🏆 Mejores plantas']].map(([v,l])=>(
          <button key={v} onClick={()=>setRTab(v)} style={{
            flex:1,padding:'10px',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:600,
            border:`1.5px solid ${rTab===v?'#7c3aed':'#e5e7eb'}`,
            background:rTab===v?'#f5f3ff':'transparent',color:rTab===v?'#7c3aed':'#6b7280'}}>
            {l}
          </button>
        ))}
      </div>

      {rTab==='monthly' && (<>
        <div style={{display:'flex',gap:10,marginBottom:18}}>
          <StatBox label="Ingresos" value={total.income} color="#16a34a"/>
          <StatBox label="Gastos"   value={total.expense} color="#dc2626"/>
          <StatBox label="Neto"     value={total.net}     color={total.net>=0?'#1d4ed8':'#ea580c'}/>
        </div>
        <div style={{fontSize:13,fontWeight:700,color:'#6b7280',marginBottom:10}}>Ingresos vs Gastos</div>
        <BarChart data={mData}/>
        <div style={{fontSize:13,fontWeight:700,color:'#6b7280',marginBottom:8}}>Resumen Mensual</div>
        <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,overflow:'hidden',marginBottom:18}}>
          <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
            <thead><tr style={{background:'#f9fafb'}}>
              {['Mes','Ingresos','Gastos','Neto'].map((h,i)=>(
                <th key={h} style={{...td(i===0?'left':'right'),fontWeight:700,fontSize:10,
                  color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</th>
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
      </>)}

      {rTab==='performers' && (<>
        {performers.length===0
          ? <div style={{textAlign:'center',padding:'40px 0',color:'#9ca3af',fontSize:14}}>
              Sin ventas registradas todavía.<br/>Los mejores artículos aparecerán aquí.
            </div>
          : performers.map((item,i)=>(
            <div key={item.id} style={S.card}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                {/* Rank badge */}
                <div style={{width:30,height:30,borderRadius:'50%',flexShrink:0,display:'flex',
                  alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,
                  background:i===0?'#fbbf24':i===1?'#9ca3af':i===2?'#d97706':'#f3f4f6',
                  color:i<3?'white':'#6b7280'}}>
                  {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#111827',overflow:'hidden',
                    textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {item.type==='plant'?'🌿':'📦'} {item.name}
                  </div>
                  <div style={{fontSize:11,color:item.cc?.color,fontWeight:600}}>{item.cc?.name}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:16,fontWeight:800,color:item.profit>=0?'#16a34a':'#dc2626'}}>
                    {item.profit>=0?'+':''}{fmt(item.profit)}
                  </div>
                  {item.roi!=null&&<div style={{fontSize:11,color:'#6b7280'}}>ROI {item.roi.toFixed(0)}%</div>}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                {[
                  ['Ventas/Cos.',`${item.salesCnt}x`,'#7c3aed'],
                  ['Promedio',fmt(item.avgSale),'#0891b2'],
                  ['En stock',`${item.days}d`,'#6b7280'],
                  ['$/día',item.profPerDay>0?`$${item.profPerDay.toFixed(2)}`:'—','#16a34a'],
                ].map(([l,v,c])=>(
                  <div key={l} style={{background:'#f9fafb',borderRadius:8,padding:'7px 4px',textAlign:'center'}}>
                    <div style={{fontSize:9,color:'#9ca3af',fontWeight:700,textTransform:'uppercase'}}>{l}</div>
                    <div style={{fontSize:12,fontWeight:700,color:c,marginTop:2}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))
        }
      </>)}
      <div style={{height:24}}/>
    </div>
  );
}


/* ── SETTINGS ─────────────────────────────────────────────── */
function Settings({ costCenters, setCostCenters }) {
  const [showAdd,setShowAdd]   = useState(false);
  const [newName,setNewName]   = useState('');
  const [newColor,setNewColor] = useState(CC_COLORS[0]);
  const [uploading,setUploading]= useState(null);

  const addCC = async () => {
    if(!newName.trim()) return;
    const cc={id:uid(),name:newName.trim(),color:newColor,photoPath:null};
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
  const uploadCCPhoto = async (ccId, file) => {
    setUploading(ccId);
    try {
      const res = await api.upload(`/api/cost-centers/${ccId}/photo`, file);
      if(res.ok) setCostCenters(p=>p.map(c=>c.id===ccId?{...c,photoPath:res.photoPath}:c));
    } finally { setUploading(null); }
  };
  const removeCCPhoto = async ccId => {
    await api.delete(`/api/cost-centers/${ccId}/photo`);
    setCostCenters(p=>p.map(c=>c.id===ccId?{...c,photoPath:null}:c));
  };

  return (
    <div style={{padding:'18px 16px',overflowY:'auto',height:'100%',boxSizing:'border-box'}}>
      <div style={{fontWeight:800,fontSize:22,color:'#111827',marginBottom:4}}>Configuración</div>
      <div style={{...S.muted,marginBottom:24}}>🌿 Bloom Aquatics · v4.0 · SQLite + Express</div>

      <div style={{fontSize:15,fontWeight:700,color:'#374151',marginBottom:14}}>Centros de Costo</div>
      {costCenters.map(cc=>{
        const url = photoUrl(cc.photoPath);
        const inputRef = { current: null };
        return (
          <div key={cc.id} style={S.card}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:cc.photoPath?12:0}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                {/* Avatar — click to change photo */}
                <div onClick={()=>inputRef.current?.click()} style={{cursor:'pointer',position:'relative'}}>
                  {url
                    ? <img src={url} style={{width:52,height:52,borderRadius:'50%',objectFit:'cover',
                        border:`2px solid ${cc.color}`}} alt={cc.name}/>
                    : <Avatar name={cc.name} color={cc.color} size={52}/>}
                  <div style={{position:'absolute',bottom:0,right:0,background:'#7c3aed',
                    borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',
                    justifyContent:'center',fontSize:10,color:'white',border:'1.5px solid white'}}>
                    {uploading===cc.id?'…':'📷'}
                  </div>
                  <input ref={el=>inputRef.current=el} type="file" accept="image/*" style={{display:'none'}}
                    onChange={e=>e.target.files?.[0]&&uploadCCPhoto(cc.id,e.target.files[0])}/>
                </div>
                <div>
                  <div style={{fontWeight:700,fontSize:18,color:cc.color}}>{cc.name}</div>
                  <div style={S.muted}>
                    {url
                      ? <span onClick={()=>removeCCPhoto(cc.id)}
                          style={{color:'#dc2626',cursor:'pointer',textDecoration:'underline'}}>
                          Eliminar foto
                        </span>
                      : 'Toca la foto para cambiarla'}
                  </div>
                </div>
              </div>
              {costCenters.length>1&&(
                <button onClick={()=>removeCC(cc.id)} style={{background:'#fef2f2',color:'#dc2626',
                  border:'1px solid #fecaca',borderRadius:10,padding:'10px 16px',cursor:'pointer',
                  fontSize:14,fontWeight:600,minHeight:46}}>Eliminar</button>
              )}
            </div>
          </div>
        );
      })}

      {!showAdd
        ?<button onClick={()=>setShowAdd(true)} style={{width:'100%',padding:'16px',borderRadius:14,
            border:'2px dashed #d1d5db',background:'transparent',color:'#6b7280',fontSize:15,
            cursor:'pointer',minHeight:56,marginTop:4}}>+ Agregar Persona al Negocio</button>
        :<div style={{...S.card,border:'2px solid #7c3aed50',marginTop:4}}>
            <div style={{fontWeight:700,fontSize:16,color:'#111827',marginBottom:14}}>Nueva Persona</div>
            <label style={S.label}>Nombre</label>
            <input value={newName} onChange={e=>setNewName(e.target.value)}
              placeholder="Ej: Papá, Carlos…" style={S.input} onKeyDown={e=>e.key==='Enter'&&addCC()}/>
            <label style={S.label}>Color</label>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:18}}>
              {CC_COLORS.map(c=>(
                <button key={c} onClick={()=>setNewColor(c)} style={{width:46,height:46,borderRadius:'50%',
                  background:c,cursor:'pointer',border:newColor===c?'3px solid #111827':'3px solid transparent',
                  transform:newColor===c?'scale(1.18)':'scale(1)',transition:'transform 0.15s'}}/>
              ))}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setShowAdd(false);setNewName('');}} style={{flex:1,padding:'14px',
                borderRadius:10,background:'#f3f4f6',border:'none',color:'#374151',fontSize:15,
                cursor:'pointer',minHeight:50}}>Cancelar</button>
              <button onClick={addCC} style={{flex:2,padding:'14px',borderRadius:10,background:'#7c3aed',
                color:'white',border:'none',fontSize:15,fontWeight:700,cursor:'pointer',minHeight:50}}>
                Guardar</button>
            </div>
          </div>}

      <div style={{marginTop:36,background:'#f5f3ff',borderRadius:14,padding:'18px 16px',border:'1px solid #ddd6fe'}}>
        <div style={{fontWeight:700,fontSize:14,color:'#4c1d95',marginBottom:14}}>🖥️ Deploy en DietPi · Puerto 4567</div>
        {[['1. Instalar','npm install'],['2. Build React','npm run build'],
          ['3. Iniciar','node server.js'],['4. PM2','pm2 start server.js --name bloom && pm2 save']
        ].map(([step,cmd])=>(
          <div key={step} style={{marginBottom:10}}>
            <div style={{fontSize:11,color:'#7c3aed',fontWeight:700,marginBottom:3}}>{step}</div>
            <div style={{fontFamily:'monospace',fontSize:12,background:'#ede9fe',padding:'8px 12px',borderRadius:8,color:'#312e81'}}>{cmd}</div>
          </div>
        ))}
        <div style={{fontSize:12,color:'#6b7280',marginTop:8,lineHeight:1.8}}>
          Puerto: <strong>4567</strong> · DB: <strong>./bloom.db</strong><br/>
          Fotos: <strong>./uploads/</strong> · Backups: <strong>./backups/</strong>
        </div>
      </div>
      <div style={{height:24}}/>
    </div>
  );
}

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
      _label:t.desc,_ccId:t.ccId,_amount:t.amount,_pos:t.type==='income',_sub:t.payment,_photo:null
    })),
    ...inventory.flatMap(i=>(i.sales||[]).filter(s=>inMY(s.saleDate,month,year)).map(s=>({
      _key:s.id,_date:s.saleDate,_icon:null,_photo:i.photoPath,_type:i.type,
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
                <div key={item._key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #f3f4f6'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,flex:1,minWidth:0}}>
                    {item._photo!==undefined
                      ? <PhotoThumb photoPath={item._photo} type={item._type} size={38} radius={8}/>
                      : <span style={{fontSize:22,flexShrink:0}}>{item._icon}</span>}
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
                        {t.type==='income'?'+':'-'}{fmt(t.amount)}</span>
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

/* ── INVENTORY ───────────────────────────────────────────── */
function Inventory({ inventory, costCenters, onAdd, onSell, onDelete, onEdit, onPhotoUpdate }) {
  const [tab,setTab]       = useState('all');
  const [fCC,setFCC]       = useState('all');
  const [saleItem,setSI]   = useState(null);
  const [photoItem,setPI]  = useState(null);
  const [editItem,setEI]   = useState(null);

  const filtered = inventory
    .filter(i=>tab==='all'||i.type===tab)
    .filter(i=>fCC==='all'||i.ccId===fCC);

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Filter chips */}
      <div style={{padding:'12px 16px 8px',borderBottom:'1px solid #e5e7eb',
        background:'#fafafa',flexShrink:0}}>
        <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:10,marginBottom:4}}>
          {[['all','🗂️ Todos'],['product','📦 Artículos'],['plant','🌿 Plantas'],['supply','🧪 Insumos']].map(([v,l])=>(
            <Chip key={v} label={l} active={tab===v} onClick={()=>setTab(v)}/>
          ))}
        </div>
        <div style={{display:'flex',gap:8,overflowX:'auto'}}>
          <Chip label="Todos" active={fCC==='all'} onClick={()=>setFCC('all')}/>
          {costCenters.map(cc=>(
            <Chip key={cc.id} label={cc.name} active={fCC===cc.id}
              onClick={()=>setFCC(cc.id)} color={cc.color}/>
          ))}
        </div>
      </div>

      {/* Item list */}
      <div style={{flex:1,overflowY:'auto',padding:'10px 16px'}}>
        {filtered.length===0
          ? <div style={{textAlign:'center',padding:'52px 0',color:'#9ca3af',fontSize:15}}>
              Sin artículos
            </div>
          : filtered.map(item=>{
              const cc=costCenters.find(c=>c.id===item.ccId);
              const isPlant=item.type==='plant', isSupply=item.type==='supply';
              const salesCnt=item.sales?.length||0;
              const totalRev=(item.sales||[]).reduce((s,x)=>s+x.salePrice,0);
              const profit=totalRev-item.purchasePrice;
              return (
                <div key={item.id} style={S.card}>
                  {/* Header row: photo + info + edit/delete */}
                  <div style={{display:'flex',justifyContent:'space-between',
                    alignItems:'flex-start',marginBottom:12}}>
                    <div style={{display:'flex',gap:12,flex:1,minWidth:0}}>
                      {/* Thumbnail — tap to change photo */}
                      <div onClick={()=>!isSupply&&setPI(item)}
                        style={{cursor:isSupply?'default':'pointer'}}>
                        <PhotoThumb photoPath={item.photoPath} type={item.type} size={56}/>
                        {!isSupply && (
                          <div style={{fontSize:9,color:'#7c3aed',textAlign:'center',
                            marginTop:3,fontWeight:600}}>
                            {item.photoPath?'cambiar':'+ foto'}
                          </div>
                        )}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:700,color:'#111827',
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {item.name}
                        </div>
                        <div style={S.muted}>
                          {item.purchaseDate} · <span style={{color:cc?.color}}>{cc?.name}</span>
                          {!isSupply&&<span> · {daysSince(item.purchaseDate)}d en stock</span>}
                          {isSupply&&<span> · {item.qty} {item.unit}</span>}
                        </div>
                        {item.notes&&<div style={{...S.muted,fontStyle:'italic'}}>{item.notes}</div>}
                      </div>
                    </div>
                    {/* Edit + Delete buttons */}
                    <div style={{display:'flex',gap:6,flexShrink:0,marginLeft:8}}>
                      <button onClick={()=>setEI(item)}
                        title="Editar artículo"
                        style={{background:'#f5f3ff',border:'none',cursor:'pointer',
                          color:'#7c3aed',fontSize:15,minWidth:36,minHeight:36,
                          borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        ✏️
                      </button>
                      <button onClick={()=>onDelete(item.id)}
                        title="Eliminar"
                        style={{background:'#fef2f2',border:'none',cursor:'pointer',
                          color:'#dc2626',fontSize:18,minWidth:36,minHeight:36,
                          borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  {isSupply
                    ? <div style={{background:'#fef2f2',borderRadius:10,padding:'10px 14px',
                        display:'flex',justifyContent:'space-between'}}>
                        <span style={{fontSize:13,color:'#6b7280'}}>Gasto registrado</span>
                        <span style={{fontSize:15,fontWeight:700,color:'#dc2626'}}>
                          {fmt(item.purchasePrice)}</span>
                      </div>
                    : <div style={{display:'flex',gap:8,marginBottom:salesCnt>0&&isPlant?12:0}}>
                        {[['Costo',   fmt(item.purchasePrice),                        '#6b7280'],
                          ['Ventas',  fmt(totalRev),                                  '#16a34a'],
                          ['Ganancia',fmt(profit),           profit>=0?'#1d4ed8':'#dc2626'],
                          [isPlant?'Cosechas':'Estado',
                           isPlant?`${salesCnt}x`:(salesCnt>0?'✓ Vendido':'Disponible'),
                           isPlant?'#7c3aed':salesCnt>0?'#16a34a':'#d97706']
                        ].map(([l,v,c])=>(
                          <div key={l} style={{flex:1,background:'#f9fafb',borderRadius:8,
                            padding:'8px 4px',textAlign:'center'}}>
                            <div style={{fontSize:10,color:'#9ca3af',fontWeight:600,
                              textTransform:'uppercase'}}>{l}</div>
                            <div style={{fontSize:13,fontWeight:700,color:c,marginTop:2}}>{v}</div>
                          </div>
                        ))}
                      </div>}

                  {/* Harvest history for plants */}
                  {isPlant&&salesCnt>0&&(
                    <div style={{borderTop:'1px solid #f3f4f6',paddingTop:10,marginTop:4}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#6b7280',marginBottom:6}}>
                        Historial de cosechas:</div>
                      {item.sales.map((s,i)=>(
                        <div key={s.id} style={{display:'flex',justifyContent:'space-between',
                          fontSize:12,color:'#6b7280',padding:'3px 0'}}>
                          <span>#{i+1} · {s.saleDate} · {s.platform}</span>
                          <span style={{color:'#16a34a',fontWeight:700}}>{fmt(s.salePrice)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sell / Harvest button */}
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

      {/* Add button */}
      <div style={{padding:'12px 16px',background:'#ffffff',
        borderTop:'1px solid #e5e7eb',flexShrink:0}}>
        <button onClick={onAdd} style={S.btn()}>+ Agregar Artículo / Planta / Insumo</button>
      </div>

      {/* Modals */}
      {saleItem&&(
        <SaleModal item={saleItem}
          onSave={sale=>{onSell(saleItem.id,sale);setSI(null);}}
          onClose={()=>setSI(null)}/>
      )}
      {editItem&&(
        <EditInvModal item={editItem} costCenters={costCenters}
          onSave={onEdit}
          onClose={()=>setEI(null)}/>
      )}
      {photoItem&&(
        <Modal title={`Foto: ${photoItem.name}`} onClose={()=>setPI(null)}>
          <PhotoUpload itemId={photoItem.id} currentPath={photoItem.photoPath}
            onUploaded={p=>{ onPhotoUpdate(photoItem.id,p); setPI(null); }}/>
          <button style={{...S.btn('#6b7280'),marginTop:8}} onClick={()=>setPI(null)}>
            Cerrar</button>
        </Modal>
      )}
    </div>
  );
}

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
    Promise.all([
      api.get('/api/cost-centers'),
      api.get('/api/transactions'),
      api.get('/api/inventory'),
    ]).then(([cc,txn,inv])=>{ setCostCenters(cc); setTxns(txn); setInv(inv); setReady(true); })
      .catch(()=>setError('No se puede conectar al servidor. ¿Está corriendo node server.js?'));
  },[]);

  const changeMonth = d => {
    let m=month+d, y=year;
    if(m>11){m=0;y++;} if(m<0){m=11;y--;}
    setMonth(m); setYear(y);
  };

  const addTxn  = async t      => { setTxns(p=>[...p,t]); await api.post('/api/transactions',t).catch(console.error); };
  const delTxn  = async id     => { setTxns(p=>p.filter(t=>t.id!==id)); await api.delete(`/api/transactions/${id}`).catch(console.error); };
  const addInv  = async i      => { setInv(p=>[...p,i]); await api.post('/api/inventory',i).catch(console.error); };
  const sellInv = async (itemId,sale) => {
    setInv(p=>p.map(i=>i.id===itemId?{...i,sales:[...(i.sales||[]),sale]}:i));
    await api.post(`/api/inventory/${itemId}/sales`,sale).catch(console.error);
  };
  const delInv  = async id     => { setInv(p=>p.filter(i=>i.id!==id)); await api.delete(`/api/inventory/${id}`).catch(console.error); };
  const editInv = async (id, changes) => {
    setInv(p=>p.map(i=>i.id===id?{...i,...changes}:i));
    await api.patch(`/api/inventory/${id}`, changes).catch(console.error);
  };
  const updatePhoto = (itemId, photoPath) => {
    setInv(p=>p.map(i=>i.id===itemId?{...i,photoPath}:i));
  };

  const NAV = [
    {id:'dashboard',   icon:'🏠', label:'Inicio'},
    {id:'transactions',icon:'💳', label:'Registro'},
    {id:'inventory',   icon:'📦', label:'Inventario'},
    {id:'vitrina',     icon:'🏪', label:'Vitrina'},
    {id:'reports',     icon:'📊', label:'Reportes'},
    {id:'settings',    icon:'⚙️', label:'Config'},
  ];

  if(error) return (
    <div style={{height:VH,display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',gap:16,padding:24,textAlign:'center'}}>
      <span style={{fontSize:48}}>⚠️</span>
      <div style={{fontWeight:700,fontSize:18,color:'#dc2626'}}>Error de conexión</div>
      <div style={{fontSize:14,color:'#6b7280'}}>{error}</div>
      <button onClick={()=>window.location.reload()} style={{padding:'14px 28px',borderRadius:12,
        background:'#7c3aed',color:'white',border:'none',fontSize:15,fontWeight:700,cursor:'pointer'}}>
        Reintentar</button>
    </div>
  );

  if(!ready) return (
    <div style={{height:VH,display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',gap:16}}>
      <span style={{fontSize:52}}>🌿</span>
      <span style={{fontSize:20,fontWeight:700,color:'#111827'}}>Bloom Aquatics</span>
      <span style={{fontSize:14,color:'#9ca3af'}}>Conectando con el servidor…</span>
    </div>
  );

  return (
    /* VH = 100dvh on mobile (accounts for browser chrome), 100vh on desktop */
    <div style={{height:VH,display:'flex',flexDirection:'column',maxWidth:480,margin:'0 auto',
      position:'relative',overflow:'hidden',background:'#f9fafb'}}>

      {/* Header */}
      <div style={{background:'#7c3aed',color:'white',padding:'12px 18px',
        display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div>
          <div style={{fontWeight:800,fontSize:19,letterSpacing:'-0.01em'}}>🌿 Bloom Aquatics</div>
          <div style={{fontSize:11,opacity:0.8,marginTop:1}}>Centro de Costos · Familiar</div>
        </div>
        <div style={{fontSize:11,opacity:0.65,textAlign:'right',lineHeight:1.6}}>
          {transactions.length} txn · {inventory.length} items
        </div>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:'auto',minHeight:0}}>
        {tab==='dashboard'    && <Dashboard    transactions={transactions} inventory={inventory} costCenters={costCenters} month={month} year={year} onMonthChange={changeMonth}/>}
        {tab==='transactions' && <Transactions transactions={transactions} inventory={inventory} costCenters={costCenters} onAdd={()=>setModal('txn')} onDelete={delTxn}/>}
        {tab==='inventory'    && <Inventory    inventory={inventory} costCenters={costCenters} onAdd={()=>setModal('inv')} onSell={sellInv} onDelete={delInv} onEdit={editInv} onPhotoUpdate={updatePhoto}/>}
        {tab==='vitrina'      && <Vitrina      inventory={inventory} costCenters={costCenters}/>}
        {tab==='reports'      && <Reports      transactions={transactions} inventory={inventory} costCenters={costCenters}/>}
        {tab==='settings'     && <Settings     costCenters={costCenters} setCostCenters={setCostCenters}/>}
      </div>

      {/* Bottom Nav */}
      <div style={{display:'flex',borderTop:'1px solid #e5e7eb',background:'#ffffff',
        flexShrink:0,paddingBottom:'env(safe-area-inset-bottom, 0px)'}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)} style={{
            flex:1, padding:'8px 1px 12px', background:'none', border:'none',
            cursor:'pointer', display:'flex', flexDirection:'column',
            alignItems:'center', gap:2, minHeight:58,
          }}>
            <span style={{fontSize:20}}>{n.icon}</span>
            <span style={{fontSize:9,fontWeight:tab===n.id?800:400,
              color:tab===n.id?'#7c3aed':'#9ca3af',letterSpacing:'0.01em',lineHeight:1}}>
              {n.label}
            </span>
          </button>
        ))}
      </div>

      {/* Modals */}
      {modal==='txn'&&<TxnModal costCenters={costCenters} inventory={inventory} onSave={addTxn} onClose={()=>setModal(null)}/>}
      {modal==='inv'&&<InvModal costCenters={costCenters} onSave={addInv} onClose={()=>setModal(null)}/>}
    </div>
  );
}