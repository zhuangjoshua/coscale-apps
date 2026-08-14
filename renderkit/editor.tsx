// Block template editor — server-rendered single page, no build step, vanilla JS.
// Mounted by the server at GET /edit/:name. Everything (CSS + JS) is inline.
//
// NOTE: this file is a plain TypeScript string template — no JSX, despite the
// .tsx extension (it lives next to the other .tsx server files).
//
// Talks to:
//   GET  /api/templates/:name  -> { name, kind:"block", doc }
//   POST /blockpreview         -> { html }
//   PUT  /api/templates/:name  -> { ok:true }
//   POST /render               -> { url }

const EDITOR_CSS = `
:root { --bg:#0E1116; --panel:#1A2029; --line:#2A3340; --text:#F2F5F8; --dim:#9AA5B1; --accent:#F5A524; --ok:#3ecf8e; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { height:100%; }
body { background:var(--bg); color:var(--text); font-family:'Avenir Next',Montserrat,'Segoe UI',system-ui,sans-serif; overflow:hidden; }
a { color:inherit; text-decoration:none; }
button { background:var(--accent); color:#1c1302; border:0; border-radius:8px; padding:9px 16px; font-size:13px; font-weight:700; cursor:pointer; }
button:hover { filter:brightness(1.1); }
button.ghost { background:transparent; color:var(--dim); border:1px solid var(--line); font-weight:600; }
button.ghost:hover { color:var(--text); border-color:var(--accent); filter:none; }
button.danger { background:transparent; color:#ff7b7b; border:1px solid #47262d; font-weight:600; }
button.danger:hover { background:#2a1418; filter:none; }
input, select, textarea { width:100%; background:#0e1118; color:var(--text); border:1px solid var(--line); border-radius:8px; padding:8px 10px; font-size:13px; font-family:inherit; }
input:focus, select:focus, textarea:focus { outline:none; border-color:var(--accent); }
textarea { resize:vertical; min-height:78px; font-family:ui-monospace,'SF Mono',Menlo,monospace; font-size:12px; line-height:1.5; }
textarea.prose { font-family:inherit; font-size:13px; line-height:1.45; }
input[type=range] { padding:0; height:22px; background:transparent; border:0; accent-color:var(--accent); }
input[type=color] { padding:0; height:32px; width:38px; flex:0 0 38px; background:transparent; border:1px solid var(--line); border-radius:8px; cursor:pointer; }
input[type=checkbox] { width:auto; }

.top { height:54px; display:flex; align-items:center; gap:16px; padding:0 18px; border-bottom:1px solid var(--line); background:var(--bg); }
.top .logo { font-weight:800; font-size:15px; letter-spacing:-0.02em; }
.top .logo span { color:var(--accent); }
.top .back { color:var(--dim); font-size:13px; }
.top .back:hover { color:var(--text); }
.top .tname { font-size:14px; font-weight:700; }
.top .kindpill { display:inline-block; border:1px solid var(--line); color:var(--dim); border-radius:999px; padding:2px 9px; font-size:11px; }
.top .spacer { flex:1; }
.state { font-size:12px; color:var(--dim); font-family:ui-monospace,monospace; min-width:110px; text-align:right; }
.state.dirty { color:#f5b83d; }
.state.ok { color:var(--ok); }

.cols { display:grid; grid-template-columns:288px minmax(0,1fr) 300px; height:calc(100vh - 54px); }
.col { min-width:0; min-height:0; overflow:auto; }
.left { border-right:1px solid var(--line); padding:16px; }
.right { border-left:1px solid var(--line); padding:16px; }
.center { display:flex; flex-direction:column; padding:16px; gap:12px; }

h3 { font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--dim); margin-bottom:10px; font-weight:700; }
.sec { margin-bottom:22px; }
.fld { margin-bottom:12px; }
.fld > label { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--dim); margin-bottom:5px; font-weight:700; }
.hint { color:var(--dim); font-size:11px; line-height:1.5; margin-top:5px; }
.inline { display:flex; gap:8px; align-items:center; }
.inline > input[type=range] { flex:1; }
.num { font-family:ui-monospace,monospace; font-size:12px; color:var(--dim); min-width:34px; text-align:right; }

.reggroup { margin-bottom:16px; }
.reghead { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.reghead h3 { margin:0; }
.reghead .cnt { font-size:11px; color:var(--dim); font-family:ui-monospace,monospace; }
.reglist { border:1px dashed transparent; border-radius:10px; padding:2px; min-height:12px; transition:border-color .12s, background .12s; }
.reglist.dropinto { border-color:var(--accent); background:rgba(245,165,36,0.07); }
.ph { color:var(--dim); font-size:12px; padding:12px 10px; text-align:center; border:1px dashed var(--line); border-radius:8px; }

.brow { display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--line); background:#10141d; border-radius:8px; margin:4px 0; cursor:grab; position:relative; user-select:none; }
.brow:hover { border-color:#33405a; }
.brow.sel { border-color:var(--accent); background:rgba(245,165,36,0.10); }
.brow.dragging { opacity:.4; }
.brow .ic { width:20px; height:20px; flex:0 0 20px; display:flex; align-items:center; justify-content:center; border-radius:5px; background:#1c2432; color:var(--accent); font-size:12px; font-weight:700; }
.brow .bt { font-size:12px; font-weight:700; }
.brow .bl { font-size:12px; color:var(--dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
.brow .bl.bind { color:var(--accent); font-family:ui-monospace,monospace; }
.brow .hid { font-size:10px; color:var(--dim); border:1px solid var(--line); border-radius:999px; padding:1px 6px; }
.brow .pos { font-size:10px; color:var(--dim); font-family:ui-monospace,monospace; white-space:nowrap; }
.reggroup.float .reglist { background:rgba(245,165,36,0.04); }
.reggroup.float .reghead h3 { color:var(--accent); }
.brow.dropbefore::before, .brow.dropafter::after { content:''; position:absolute; left:0; right:0; height:2px; background:var(--accent); border-radius:2px; }
.brow.dropbefore::before { top:-4px; }
.brow.dropafter::after { bottom:-4px; }
.addbtn { width:100%; margin-top:6px; padding:7px 10px; font-size:12px; }

.palette { position:fixed; z-index:60; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:6px; width:170px; box-shadow:0 12px 34px rgba(0,0,0,.55); }
.palette button { display:flex; align-items:center; gap:9px; width:100%; background:transparent; color:var(--text); font-weight:600; font-size:13px; padding:7px 9px; text-align:left; border-radius:7px; }
.palette button:hover { background:#1c2432; filter:none; }
.palette .ic { width:20px; height:20px; flex:0 0 20px; display:flex; align-items:center; justify-content:center; border-radius:5px; background:#1c2432; color:var(--accent); font-size:12px; font-weight:700; }

.stage { flex:1; min-height:0; display:flex; align-items:center; justify-content:center; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; overflow:hidden; }
.holder { position:relative; background:#000; border-radius:6px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,.5); }
.holder iframe { border:0; display:block; transform-origin:0 0; background:#fff; }
.belowbar { display:flex; align-items:center; gap:12px; }
.belowbar .meta { font-size:12px; color:var(--dim); font-family:ui-monospace,monospace; }
.belowbar .spacer { flex:1; }

.swatches { display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap; }
.sw { width:32px; height:28px; border-radius:7px; border:1px solid var(--line); cursor:pointer; padding:0; }
.sw.on { border-color:var(--accent); box-shadow:0 0 0 2px rgba(245,165,36,.3); }
.seg { display:flex; gap:6px; }
.seg button { flex:1; background:transparent; color:var(--dim); border:1px solid var(--line); font-weight:700; padding:7px 0; }
.seg button.on { background:var(--accent); color:#1c1302; border-color:var(--accent); }
.chk { display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; margin-bottom:12px; }
details.adv { margin-bottom:12px; }
details.adv > summary { cursor:pointer; color:var(--dim); font-size:11px; text-transform:uppercase; letter-spacing:.06em; font-weight:700; padding:4px 0; list-style:none; }
details.adv > summary::-webkit-details-marker { display:none; }
details.adv > summary::before { content:'▸ '; }
details.adv[open] > summary::before { content:'▾ '; }
details.adv > summary:hover { color:var(--text); }
details.adv .fld { margin-top:6px; margin-bottom:0; }
.linkbtn { background:transparent; border:0; padding:4px 0; color:var(--dim); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; cursor:pointer; }
.linkbtn:hover { color:var(--accent); filter:none; }

.frow { display:grid; grid-template-columns:1fr 1fr 76px 1fr 28px; gap:5px; margin-bottom:6px; align-items:center; }
.frow input, .frow select { padding:6px 7px; font-size:12px; }
.frow .x { padding:6px 0; font-size:14px; line-height:1; }

.modal { position:fixed; inset:0; background:rgba(4,7,12,.82); display:flex; align-items:center; justify-content:center; z-index:80; padding:36px; }
.modal .box { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; max-width:90vw; max-height:90vh; overflow:auto; }
.modal img { max-width:100%; max-height:70vh; display:block; border-radius:8px; border:1px solid var(--line); }
.modal .mrow { display:flex; gap:10px; align-items:center; margin-top:12px; }
.modal .mrow a { color:var(--accent); font-size:12px; font-family:ui-monospace,monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.toast { position:fixed; bottom:18px; left:50%; transform:translateX(-50%); background:var(--panel); border:1px solid var(--line); color:var(--text); border-radius:8px; padding:9px 16px; font-size:13px; z-index:90; box-shadow:0 10px 30px rgba(0,0,0,.5); }
.empty { color:var(--dim); font-size:13px; line-height:1.6; }
`;

// ---------------------------------------------------------------- client JS
// IMPORTANT: no backticks and no "${" anywhere in this string — it is embedded
// inside a TS template literal. String concatenation only.
const EDITOR_JS = `
var TPL_NAME = window.__TPL_NAME__;
var TYPES = ['text','image','stars','badge','divider','spacer','list'];
var ICONS = { text:'T', image:'\\u25A3', stars:'\\u2605', badge:'\\u25CF', divider:'\\u2014', spacer:'\\u2423', list:'\\u2261' };
var PRESETS = ['stacked','split-left','split-right','background'];
var ALL_REGIONS = ['top','middle','bottom','floating'];
var REGION_HINTS = {
  top: 'Empty \\u2014 drop blocks here',
  middle: 'Empty \\u2014 drop blocks here',
  bottom: 'Empty \\u2014 drop blocks here',
  floating: 'Empty \\u2014 floating blocks position freely'
};
var THEME_KEYS = ['bg','accent','text','muted'];

var doc = null;
var selectedId = null;
var dirty = false;
var previewTimer = null;
var dragging = null;
var toastTimer = null;

// direct-manipulation state (see the section near the bottom of this file)
var fdoc = null;            // the preview iframe's document (srcdoc => same origin)
var fwin = null;
var previewScale = 1;       // parent-side CSS scale of the iframe
var editing = null;         // { id, el, type } while inline text editing
var pend = null;            // mousedown that may become a drag
var gest = null;            // active gesture: float / flow / resize

function $(id){ return document.getElementById(id); }
function esc(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function uid(){ return 'b' + Math.random().toString(36).slice(2,8) + Math.random().toString(36).slice(2,4); }
function clamp(n, lo, hi){ n = Number(n); if (!isFinite(n)) n = lo; return Math.max(lo, Math.min(hi, n)); }

function toast(msg){
  var el = $('toast');
  el.textContent = msg;
  el.style.display = 'block';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.style.display = 'none'; }, 2200);
}

// ------------------------------------------------------------------ doc model
function defaultDoc(){
  return {
    name: TPL_NAME, kind: 'block',
    canvas: { width: 1200, height: 630 },
    preset: 'stacked',
    theme: { bg:'#101418', accent:'#4da3ff', text:'#eef2f7', muted:'#8b93a5', font:'Inter' },
    fields: { headline: { type:'text', label:'Headline', default:'Your headline here' } },
    regions: { top: [], middle: [ { id: uid(), type:'text', bind:'headline', style:{ size:64, weight:800 } } ], bottom: [] }
  };
}

function normalize(d){
  if (!d || typeof d !== 'object') d = {};
  d.name = TPL_NAME;
  d.kind = 'block';
  var c = d.canvas;
  if (!c || !Number(c.width) || !Number(c.height)) d.canvas = { width:1200, height:630 };
  else d.canvas = { width: Number(c.width), height: Number(c.height) };
  if (PRESETS.indexOf(d.preset) < 0) d.preset = 'stacked';
  var t = (d.theme && typeof d.theme === 'object') ? d.theme : {};
  d.theme = {
    bg: t.bg || '#101418', accent: t.accent || '#4da3ff', text: t.text || '#eef2f7',
    muted: t.muted || '#8b93a5', font: t.font || 'Inter'
  };
  if (d.media && typeof d.media !== 'object') delete d.media;
  if (!d.fields || typeof d.fields !== 'object' || Array.isArray(d.fields)) d.fields = {};
  var fk = Object.keys(d.fields);
  for (var i = 0; i < fk.length; i++) {
    var f = d.fields[fk[i]];
    if (!f || typeof f !== 'object') { d.fields[fk[i]] = { type:'text', label: fk[i], default:'' }; continue; }
    if (['text','number','image','list'].indexOf(f.type) < 0) f.type = 'text';
    if (typeof f.label !== 'string' || !f.label) f.label = fk[i];
  }
  var r = (d.regions && typeof d.regions === 'object') ? d.regions : {};
  d.regions = {
    top: Array.isArray(r.top) ? r.top : [],
    middle: Array.isArray(r.middle) ? r.middle : [],
    bottom: Array.isArray(r.bottom) ? r.bottom : []
  };
  // floating is optional: keep it absent unless the doc actually has one, so we
  // never write an empty key into docs that do not use floating blocks.
  if (Array.isArray(r.floating)) d.regions.floating = r.floating;
  var seen = {};
  for (var q = 0; q < ALL_REGIONS.length; q++) {
    var key = ALL_REGIONS[q];
    if (!Array.isArray(d.regions[key])) continue;
    d.regions[key] = d.regions[key].filter(function(b){ return b && typeof b === 'object'; });
    d.regions[key].forEach(function(b){
      if (typeof b.id !== 'string' || !b.id || seen[b.id]) b.id = uid();
      seen[b.id] = true;
      if (TYPES.indexOf(b.type) < 0) b.type = 'text';
      if (!b.style || typeof b.style !== 'object') b.style = {};
      if (b.type === 'list' && (!b.listColumns || typeof b.listColumns !== 'object')) {
        b.listColumns = { labelKey:'name', valueKey:'price' };
      }
      if (key === 'floating') applyFloatDefaults(b);
      else clearFloatCoords(b);
    });
  }
  return d;
}

// Floating blocks carry percent coords; flow blocks must not.
function applyFloatDefaults(b){
  if (!b.style) b.style = {};
  if (typeof b.style.x !== 'number' || !isFinite(b.style.x)) b.style.x = 50;
  if (typeof b.style.y !== 'number' || !isFinite(b.style.y)) b.style.y = 50;
  b.style.x = clamp(b.style.x, 0, 100);
  b.style.y = clamp(b.style.y, 0, 100);
}
function clearFloatCoords(b){
  if (!b.style) return;
  delete b.style.x;
  delete b.style.y;
  delete b.style.w;   // box width is floating-only; flow blocks size to their region
}
function regionArr(reg){
  var a = doc && doc.regions ? doc.regions[reg] : null;
  return Array.isArray(a) ? a : [];
}

function newBlock(type){
  var b = { id: uid(), type: type, style: {} };
  if (type === 'text') { b.value = 'Text'; b.style = { size:32, weight:600, marginBottom:12 }; }
  else if (type === 'image') { b.value = ''; b.style = { size:50, marginBottom:12 }; }
  else if (type === 'stars') { b.value = 5; b.style = { size:28, marginBottom:8 }; }
  else if (type === 'badge') { b.value = 'Badge'; b.style = { size:18, marginBottom:12 }; }
  else if (type === 'divider') { b.style = { marginBottom:16 }; }
  else if (type === 'spacer') { b.style = { size:24 }; }
  else if (type === 'list') { b.value = []; b.listColumns = { labelKey:'name', valueKey:'price' }; b.style = { size:22, marginBottom:12 }; }
  return b;
}

function findBlock(id){
  for (var i = 0; i < ALL_REGIONS.length; i++) {
    var reg = ALL_REGIONS[i], arr = regionArr(reg);
    for (var j = 0; j < arr.length; j++) if (arr[j].id === id) return { region: reg, index: j, block: arr[j] };
  }
  return null;
}

function fieldKeys(){ return doc && doc.fields ? Object.keys(doc.fields) : []; }

function sampleData(){
  var out = {};
  var f = (doc && doc.fields) || {};
  var keys = Object.keys(f);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], def = f[k].default;
    if (def === undefined || def === null) {
      def = f[k].type === 'list' ? [] : (f[k].type === 'number' ? 0 : '');
    }
    out[k] = def;
  }
  return out;
}

// ------------------------------------------------------------------- mutation
// Single funnel for every change. Snapshots first; a throwing mutator restores
// the previous doc so a botched drop can never lose a block.
function mutate(fn){
  var snap;
  try { snap = JSON.stringify(doc); } catch (e) { snap = null; }
  var ok = true;
  try { fn(doc); }
  catch (err) {
    ok = false;
    if (snap) { try { doc = JSON.parse(snap); } catch (e2) {} }
    console.error('mutate failed', err);
    toast('Change could not be applied');
  }
  markDirty(true);
  renderTree();
  schedulePreview();
  if (!ok) renderProps();
}

function markDirty(v){
  dirty = v;
  var el = $('state');
  el.className = 'state' + (v ? ' dirty' : '');
  el.textContent = v ? 'Unsaved changes' : 'All changes saved';
}

// -------------------------------------------------------------------- preview
function schedulePreview(){
  // Inline editing types straight into the live DOM; replacing srcdoc would kill
  // the caret, so refreshes are suppressed until the edit ends.
  if (editing) return;
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 150);
}

function refreshPreview(){
  if (!doc) return;
  if (editing) return;
  // never yank the document out from under an in-flight gesture
  if (gest) { previewTimer = setTimeout(refreshPreview, 180); return; }
  var body;
  try { body = JSON.stringify({ doc: doc, data: sampleData() }); }
  catch (e) { return; }
  fetch('/blockpreview', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: body })
    .then(function(r){ return r.json(); })
    .then(function(j){
      if (j && typeof j.html === 'string') $('frame').srcdoc = j.html;
      else if (j && j.error) toast('Preview error: ' + j.error);
      fitPreview();
    })
    .catch(function(){ toast('Preview unavailable'); });
}

function fitPreview(){
  if (!doc) return;
  var stage = $('stage'), holder = $('holder'), frame = $('frame');
  var w = doc.canvas.width, h = doc.canvas.height;
  var aw = Math.max(80, stage.clientWidth - 32);
  var ah = Math.max(60, stage.clientHeight - 32);
  var s = Math.min(aw / w, ah / h);
  if (!isFinite(s) || s <= 0) s = 0.5;
  previewScale = s;
  frame.style.width = w + 'px';
  frame.style.height = h + 'px';
  frame.style.transform = 'scale(' + s + ')';
  holder.style.width = Math.round(w * s) + 'px';
  holder.style.height = Math.round(h * s) + 'px';
  $('dims').textContent = w + ' x ' + h + '  (' + Math.round(s * 100) + '%)';
  syncPreview();
}

// ----------------------------------------------------------------- left panel
function blockLabel(b){
  if (b.bind) return b.bind;
  if (b.type === 'divider') return 'rule';
  if (b.type === 'spacer') return ((b.style && b.style.size) || 24) + 'px gap';
  var v = b.value;
  if (Array.isArray(v)) return v.length + ' items';
  if (v === undefined || v === null || v === '') return 'not set';
  var s = String(v).replace(/\\s+/g, ' ').trim();
  if (s.length > 24) s = s.slice(0, 24) + '\\u2026';
  return s;
}

function fmtPct(n){
  var v = (typeof n === 'number' && isFinite(n)) ? n : 50;
  return (Math.round(v * 10) / 10) + '%';
}

function renderTree(){
  var html = '';
  for (var i = 0; i < ALL_REGIONS.length; i++) {
    var reg = ALL_REGIONS[i];
    var arr = regionArr(reg);
    var rows = '';
    for (var j = 0; j < arr.length; j++) {
      var b = arr[j];
      var st = b.style || {};
      var pos = reg === 'floating'
        ? '<span class="pos">' + fmtPct(st.x) + ',' + fmtPct(st.y) + '</span>' : '';
      rows += '<div class="brow' + (b.id === selectedId ? ' sel' : '') + '" draggable="true"'
        + ' data-id="' + esc(b.id) + '" data-region="' + reg + '">'
        + '<span class="ic">' + (ICONS[b.type] || '?') + '</span>'
        + '<span class="bt">' + esc(b.type) + '</span>'
        + '<span class="bl' + (b.bind ? ' bind' : '') + '">' + esc(blockLabel(b)) + '</span>'
        + pos
        + (b.visible === false ? '<span class="hid">hidden</span>' : '')
        + '</div>';
    }
    if (!rows) rows = '<div class="ph">' + REGION_HINTS[reg] + '</div>';
    html += '<div class="reggroup' + (reg === 'floating' ? ' float' : '') + '">'
      + '<div class="reghead"><h3>' + reg.toUpperCase() + '</h3><span class="cnt">' + arr.length + '</span></div>'
      + '<div class="reglist" data-region="' + reg + '">' + rows + '</div>'
      + '<button class="ghost addbtn" data-add="' + reg + '">+ Add block</button>'
      + '</div>';
  }
  $('tree').innerHTML = html;
  wireTree();
}

function wireTree(){
  var rows = $('tree').querySelectorAll('.brow');
  for (var i = 0; i < rows.length; i++) {
    (function(row){
      row.addEventListener('click', function(){ select(row.getAttribute('data-id')); });
      row.addEventListener('dragstart', function(e){
        dragging = { id: row.getAttribute('data-id'), region: row.getAttribute('data-region') };
        row.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', dragging.id); } catch (err) {}
        }
      });
      row.addEventListener('dragend', function(){
        row.classList.remove('dragging');
        clearIndicators();
        dragging = null;
      });
    })(rows[i]);
  }

  var lists = $('tree').querySelectorAll('.reglist');
  for (var k = 0; k < lists.length; k++) {
    (function(list){
      list.addEventListener('dragover', function(e){
        if (!dragging) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        showIndicator(list, computeIndex(list, e.clientY));
      });
      list.addEventListener('dragleave', function(e){
        if (e.relatedTarget && list.contains(e.relatedTarget)) return;
        list.classList.remove('dropinto');
      });
      list.addEventListener('drop', function(e){
        e.preventDefault();
        e.stopPropagation();
        var idx = computeIndex(list, e.clientY);
        var target = list.getAttribute('data-region');
        var drag = dragging;
        clearIndicators();
        dragging = null;
        if (!drag) return;
        moveBlock(drag.id, drag.region, target, idx);
      });
    })(lists[k]);
  }

  var adds = $('tree').querySelectorAll('[data-add]');
  for (var a = 0; a < adds.length; a++) {
    (function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        openPalette(btn, btn.getAttribute('data-add'));
      });
    })(adds[a]);
  }
}

function computeIndex(list, clientY){
  var rows = list.querySelectorAll('.brow');
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i].getBoundingClientRect();
    if (clientY < r.top + r.height / 2) return i;
  }
  return rows.length;
}

function clearIndicators(){
  var els = document.querySelectorAll('.dropbefore, .dropafter, .dropinto');
  for (var i = 0; i < els.length; i++) {
    els[i].classList.remove('dropbefore');
    els[i].classList.remove('dropafter');
    els[i].classList.remove('dropinto');
  }
}

function showIndicator(list, idx){
  clearIndicators();
  var rows = list.querySelectorAll('.brow');
  if (!rows.length) { list.classList.add('dropinto'); return; }
  if (idx >= rows.length) rows[rows.length - 1].classList.add('dropafter');
  else rows[idx].classList.add('dropbefore');
}

function moveBlock(id, fromRegion, toRegion, toIndex){
  if (ALL_REGIONS.indexOf(toRegion) < 0) { renderTree(); return; }
  mutate(function(d){
    var src = d.regions[fromRegion];
    if (!Array.isArray(src)) throw new Error('unknown source region ' + fromRegion);
    var i = -1;
    for (var n = 0; n < src.length; n++) if (src[n].id === id) { i = n; break; }
    if (i < 0) throw new Error('block ' + id + ' not found');
    var moved = src.splice(i, 1)[0];
    if (!Array.isArray(d.regions[toRegion])) d.regions[toRegion] = [];
    var dst = d.regions[toRegion];
    var idx = toIndex;
    if (fromRegion === toRegion && i < idx) idx = idx - 1;
    if (!(idx >= 0)) idx = 0;
    if (idx > dst.length) idx = dst.length;
    dst.splice(idx, 0, moved);
    if (toRegion === 'floating') applyFloatDefaults(moved);
    else if (fromRegion === 'floating') clearFloatCoords(moved);
  });
  select(id);
}

// -------------------------------------------------------------------- palette
function openPalette(anchor, region){
  closePalette();
  var box = document.createElement('div');
  box.className = 'palette';
  box.id = 'palette';
  var html = '';
  for (var i = 0; i < TYPES.length; i++) {
    var t = TYPES[i];
    html += '<button data-type="' + t + '"><span class="ic">' + ICONS[t] + '</span>' + t + '</button>';
  }
  box.innerHTML = html;
  document.body.appendChild(box);
  var r = anchor.getBoundingClientRect();
  var top = r.bottom + 6;
  if (top + box.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - box.offsetHeight - 6);
  box.style.top = top + 'px';
  box.style.left = Math.max(8, r.left) + 'px';
  var btns = box.querySelectorAll('button');
  for (var j = 0; j < btns.length; j++) {
    (function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var type = btn.getAttribute('data-type');
        var b = newBlock(type);
        mutate(function(d){
          if (!Array.isArray(d.regions[region])) d.regions[region] = [];
          if (region === 'floating') applyFloatDefaults(b);
          d.regions[region].push(b);
        });
        closePalette();
        select(b.id);
      });
    })(btns[j]);
  }
  setTimeout(function(){ document.addEventListener('mousedown', paletteOutside); }, 0);
}
function paletteOutside(e){
  var box = $('palette');
  if (box && !box.contains(e.target)) closePalette();
}
function closePalette(){
  var box = $('palette');
  if (box && box.parentNode) box.parentNode.removeChild(box);
  document.removeEventListener('mousedown', paletteOutside);
}

// ------------------------------------------------------------ preset + media
function renderPresetRow(){
  var opts = '';
  for (var i = 0; i < PRESETS.length; i++) {
    opts += '<option value="' + PRESETS[i] + '"' + (doc.preset === PRESETS[i] ? ' selected' : '') + '>' + PRESETS[i] + '</option>';
  }
  $('presetWrap').innerHTML = '<div class="fld"><label>Preset</label><select id="presetSel">' + opts + '</select></div>';
  $('presetSel').addEventListener('change', function(){
    var v = this.value;
    mutate(function(d){ d.preset = v; });
    renderMediaRow();
  });
}

function renderMediaRow(){
  var wrap = $('mediaWrap');
  if (doc.preset === 'stacked') { wrap.innerHTML = ''; return; }
  var m = doc.media || {};
  var keys = fieldKeys();
  var opts = '<option value="">static URL</option>';
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], f = doc.fields[k];
    opts += '<option value="' + esc(k) + '"' + (m.bind === k ? ' selected' : '') + '>'
      + esc(k) + ' (' + esc(f.type) + ')</option>';
  }
  if (m.bind && keys.indexOf(m.bind) < 0) {
    opts += '<option value="' + esc(m.bind) + '" selected>' + esc(m.bind) + ' (missing field)</option>';
  }
  wrap.innerHTML = '<div class="fld"><label>Media source</label><select id="mediaBind">' + opts + '</select></div>'
    + '<div class="fld"><label>' + (m.bind ? 'Fallback URL' : 'Image URL') + '</label>'
    + '<input id="mediaUrl" placeholder="https://..." value="' + esc(m.value || '') + '"></div>';

  $('mediaBind').addEventListener('change', function(){
    var v = this.value;
    mutate(function(d){
      if (!d.media) d.media = {};
      if (v) d.media.bind = v; else delete d.media.bind;
    });
    renderMediaRow();
  });
  $('mediaUrl').addEventListener('input', function(){
    var v = this.value;
    mutate(function(d){
      if (!d.media) d.media = {};
      d.media.value = v;
    });
  });
}

// ---------------------------------------------------------------- right panel
function select(id){
  selectedId = id;
  renderTree();
  renderProps();
}

function bindOptions(b){
  var keys = fieldKeys();
  var opts = '<option value=""' + (!b.bind ? ' selected' : '') + '>static value</option>';
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    opts += '<option value="' + esc(k) + '"' + (b.bind === k ? ' selected' : '') + '>'
      + esc(doc.fields[k].label || k) + ' \\u2014 ' + esc(k) + '</option>';
  }
  if (b.bind && keys.indexOf(b.bind) < 0) {
    opts += '<option value="' + esc(b.bind) + '" selected>' + esc(b.bind) + ' (missing field)</option>';
  }
  return opts;
}

function colorControl(idPrefix, current){
  var html = '<div class="swatches">';
  for (var i = 0; i < THEME_KEYS.length; i++) {
    var k = THEME_KEYS[i];
    html += '<button type="button" class="sw' + (current === k ? ' on' : '') + '" data-col="' + k + '"'
      + ' title="' + k + '" style="background:' + esc(doc.theme[k]) + '"></button>';
  }
  html += '</div><div class="inline"><input id="' + idPrefix + 'Hex" placeholder="accent or #ff0000" value="'
    + esc(current || '') + '"><input type="color" id="' + idPrefix + 'Pick" value="'
    + esc(hexOf(current)) + '"></div>';
  return html;
}

function hexOf(c){
  if (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) return c;
  if (c && doc.theme[c] && /^#[0-9a-fA-F]{6}$/.test(doc.theme[c])) return doc.theme[c];
  return '#ffffff';
}

function renderProps(){
  var p = $('props');
  var found = selectedId ? findBlock(selectedId) : null;
  if (!found) { selectedId = null; p.innerHTML = docPanelHtml(); wireDocPanel(); syncPreview(); return; }
  p.innerHTML = blockPanelHtml(found.block, found.region);
  wireBlockPanel(found.block.id);
  // the preview is the third view of the same selection — keep it in step
  syncPreview();
}

var VALUE_LABELS = { text:'Text', number:'Number', image:'Image URL', list:'Items (JSON)' };

// Which editor widget suits a block's own static value.
function valueKindOfBlock(t){
  if (t === 'list') return 'list';
  if (t === 'stars') return 'number';
  if (t === 'image') return 'image';
  if (t === 'text') return 'text';
  return 'line';
}

// One widget builder shared by the field-default control and the static/fallback
// control, so both stay styled and parsed identically.
function valueInput(id, kind, val){
  if (kind === 'list') {
    var jv = '[]';
    try { jv = JSON.stringify(Array.isArray(val) ? val : [], null, 0); } catch (e) { jv = '[]'; }
    return '<textarea id="' + id + '" rows="4">' + esc(jv) + '</textarea>';
  }
  var v = (val === undefined || val === null) ? '' : val;
  if (kind === 'number') return '<input type="number" id="' + id + '" value="' + esc(v) + '">';
  if (kind === 'image') return '<input id="' + id + '" placeholder="https://..." value="' + esc(v) + '">';
  if (kind === 'text') return '<textarea class="prose" id="' + id + '" rows="4">' + esc(v) + '</textarea>';
  return '<input id="' + id + '" value="' + esc(v) + '">';
}

function blockPanelHtml(b, region){
  var floating = region === 'floating';
  var st = b.style || {};
  var t = b.type;
  var showSize = t !== 'divider';
  var showColor = t !== 'spacer';
  var showWeight = (t === 'text' || t === 'badge' || t === 'list' || t === 'stars');
  var showAlign = (t !== 'spacer' && t !== 'divider');
  var showValue = (t !== 'divider' && t !== 'spacer');
  var sizeLabel = t === 'spacer' ? 'Height' : (t === 'image' ? 'Scale' : 'Size');

  var h = '<div class="sec">'
    + '<h3>' + esc(t) + ' block' + (floating ? ' \\u00b7 floating' : '') + '</h3>';

  if (showValue) {
    h += '<div class="fld"><label>Source</label><select id="pBind">' + bindOptions(b) + '</select></div>';
    var bKind = valueKindOfBlock(t);
    var boundField = b.bind ? doc.fields[b.bind] : null;

    if (b.bind && boundField) {
      // The field default is what actually renders, so it is the primary control.
      h += '<div class="fld"><label>' + VALUE_LABELS[boundField.type || 'text'] + '</label>'
        + valueInput('pFieldDef', boundField.type || 'text', boundField.default)
        + '<div class="hint">Default for the &#39;' + esc(b.bind) + '&#39; field \\u2014 every block bound to it '
        + 'updates. API data overrides this at render time.</div></div>';
      // b.value still matters at render time if a caller omits the key, so keep
      // it reachable — just not in the way.
      h += '<details class="adv"><summary>Fallback value</summary><div class="fld">'
        + valueInput('pValue', bKind, b.value)
        + '<div class="hint">Only used if the field is deleted or has no default. Usually leave empty.</div>'
        + '</div></details>';
    } else if (b.bind) {
      h += '<div class="fld"><label>Fallback value</label>'
        + valueInput('pValue', bKind, b.value)
        + '<div class="hint">Field &#39;' + esc(b.bind) + '&#39; does not exist, so this value is what renders. '
        + 'Add the field below, or pick another source.</div></div>';
    } else {
      h += '<div class="fld"><label>' + (t === 'list' ? 'Items (JSON)' : 'Value') + '</label>'
        + valueInput('pValue', bKind, b.value)
        + (t === 'list' ? '<div class="hint">Array of objects, e.g. [{"name":"Coffee","price":"$4"}]</div>' : '')
        + '</div>';
    }
  }

  if (t === 'list') {
    var lc = b.listColumns || { labelKey:'name', valueKey:'price' };
    h += '<div class="fld"><label>Label key</label><input id="pLabelKey" value="' + esc(lc.labelKey || '') + '"></div>'
      + '<div class="fld"><label>Value key</label><input id="pValueKey" value="' + esc(lc.valueKey || '') + '"></div>';
  }

  h += '</div><div class="sec"><h3>Style</h3>';

  if (showSize) {
    h += '<div class="fld"><label>' + sizeLabel + '</label><div class="inline">'
      + '<input type="range" id="pSize" min="10" max="140" step="1" value="' + clamp(st.size === undefined ? 24 : st.size, 10, 140) + '">'
      + '<span class="num" id="pSizeNum">' + clamp(st.size === undefined ? 24 : st.size, 10, 140) + '</span></div></div>';
  }
  if (showColor) {
    h += '<div class="fld"><label>Color</label>' + colorControl('pCol', st.color) + '</div>';
  }
  if (showWeight) {
    var ws = [400, 600, 700, 800];
    var wo = '';
    for (var i = 0; i < ws.length; i++) {
      wo += '<option value="' + ws[i] + '"' + ((st.weight || 400) === ws[i] ? ' selected' : '') + '>' + ws[i] + '</option>';
    }
    h += '<div class="fld"><label>Weight</label><select id="pWeight">' + wo + '</select></div>';
  }
  if (showAlign) {
    var al = st.align || 'left';
    h += '<div class="fld"><label>Align</label><div class="seg">'
      + '<button type="button" data-align="left" class="' + (al === 'left' ? 'on' : '') + '">L</button>'
      + '<button type="button" data-align="center" class="' + (al === 'center' ? 'on' : '') + '">C</button>'
      + '<button type="button" data-align="right" class="' + (al === 'right' ? 'on' : '') + '">R</button>'
      + '</div></div>';
  }
  h += '<div class="fld"><label>Margin bottom</label><div class="inline">'
    + '<input type="range" id="pMargin" min="0" max="60" step="1" value="' + clamp(st.marginBottom || 0, 0, 60) + '">'
    + '<span class="num" id="pMarginNum">' + clamp(st.marginBottom || 0, 0, 60) + '</span></div></div>';

  if (floating) {
    var px = clamp(typeof st.x === 'number' ? st.x : 50, 0, 100);
    var py = clamp(typeof st.y === 'number' ? st.y : 50, 0, 100);
    h += '<div class="fld"><label>Position X</label><div class="inline">'
      + '<input type="range" id="pPosX" min="0" max="100" step="0.5" value="' + px + '">'
      + '<span class="num" id="pPosXNum">' + px + '%</span></div></div>'
      + '<div class="fld"><label>Position Y</label><div class="inline">'
      + '<input type="range" id="pPosY" min="0" max="100" step="0.5" value="' + py + '">'
      + '<span class="num" id="pPosYNum">' + py + '%</span></div>'
      + '<button type="button" class="linkbtn" id="pPosCenter">Center</button>'
      + '<div class="hint">Percent of canvas \\u2014 0 is flush left/top, 100 flush right/bottom. Blocks always stay on-canvas.</div></div>';

    // Box width: unset means "size to content". With no stored value the slider
    // starts at the block's currently rendered width so dragging it is not a jump.
    var maxW = maxBoxW();
    var setW = (typeof st.w === 'number' && isFinite(st.w)) ? clamp(st.w, 60, maxW) : null;
    var slidW = setW !== null ? setW : clamp(renderedWidthOf(b.id) || Math.round(cvW() / 2), 60, maxW);
    h += '<div class="fld"><label>Box width</label><div class="inline">'
      + '<input type="range" id="pBoxW" min="60" max="' + maxW + '" step="1" value="' + slidW + '">'
      + '<span class="num" id="pBoxWNum">' + (setW !== null ? setW : 'auto') + '</span></div>'
      + '<button type="button" class="linkbtn" id="pBoxWAuto">Auto</button>'
      + '<div class="hint">Fixed box width in px \\u2014 text wraps inside. Auto sizes to content. '
      + 'Drag the bar on the block\\u2019s right edge to set it visually.</div></div>';
  }

  var nx = clamp(st.offsetX || 0, -200, 200);
  var ny = clamp(st.offsetY || 0, -200, 200);
  h += '<div class="fld"><label>Nudge X</label><div class="inline">'
    + '<input type="range" id="pOffX" min="-200" max="200" step="1" value="' + nx + '">'
    + '<span class="num" id="pOffXNum">' + nx + '</span></div></div>'
    + '<div class="fld"><label>Nudge Y</label><div class="inline">'
    + '<input type="range" id="pOffY" min="-200" max="200" step="1" value="' + ny + '">'
    + '<span class="num" id="pOffYNum">' + ny + '</span></div>'
    + '<button type="button" class="linkbtn" id="pOffReset">Reset nudge</button>'
    + '<div class="hint">Visual offset in px \\u2014 does not affect layout flow.</div></div>';

  h += '</div><div class="sec"><h3>Options</h3>'
    + '<label class="chk"><input type="checkbox" id="pVisible"' + (b.visible === false ? '' : ' checked') + '> Visible</label>';
  if (t === 'text') {
    h += '<label class="chk"><input type="checkbox" id="pFit"' + (b.fit ? ' checked' : '') + '> Shrink to fit</label>';
  }
  h += '<button class="danger" id="pDelete" style="width:100%">Delete block</button>'
    + '<div class="hint">Or press Delete with the block selected.</div>'
    + '</div>';
  return h;
}

function withBlock(id, fn){
  mutate(function(){
    var f = findBlock(id);
    if (!f) throw new Error('selected block disappeared');
    if (!f.block.style) f.block.style = {};
    fn(f.block);
  });
}

function wireBlockPanel(id){
  var p = $('props');
  var el;

  el = $('pBind');
  if (el) el.addEventListener('change', function(){
    var v = this.value;
    withBlock(id, function(b){ if (v) b.bind = v; else delete b.bind; });
    renderProps();
  });

  // Primary control for a bound block: writes doc.fields[bind].default, not the
  // block. No renderProps here, so typing keeps focus and caret.
  el = $('pFieldDef');
  if (el) el.addEventListener('input', function(){
    var raw = this.value;
    var f0 = findBlock(id);
    var key = f0 ? f0.block.bind : null;
    if (!key) return;
    mutate(function(d){
      var fd = d.fields[key];
      if (!fd) throw new Error('field ' + key + ' missing');
      if (fd.type === 'number') fd.default = raw === '' ? 0 : Number(raw);
      else if (fd.type === 'list') { try { fd.default = JSON.parse(raw); } catch (e) { return; } }
      else fd.default = raw;
    });
  });

  el = $('pValue');
  if (el) el.addEventListener('input', function(){
    var raw = this.value;
    var f = findBlock(id);
    var isList = f && f.block.type === 'list';
    withBlock(id, function(b){
      if (isList) {
        var parsed;
        try { parsed = JSON.parse(raw); } catch (e) { return; }
        b.value = Array.isArray(parsed) ? parsed : [];
      } else if (b.type === 'stars') {
        b.value = raw === '' ? '' : Number(raw);
      } else {
        b.value = raw;
      }
    });
  });

  el = $('pLabelKey');
  if (el) el.addEventListener('input', function(){
    var v = this.value;
    withBlock(id, function(b){
      if (!b.listColumns) b.listColumns = { labelKey:'name', valueKey:'price' };
      b.listColumns.labelKey = v;
    });
  });
  el = $('pValueKey');
  if (el) el.addEventListener('input', function(){
    var v = this.value;
    withBlock(id, function(b){
      if (!b.listColumns) b.listColumns = { labelKey:'name', valueKey:'price' };
      b.listColumns.valueKey = v;
    });
  });

  el = $('pSize');
  if (el) el.addEventListener('input', function(){
    var v = clamp(this.value, 10, 140);
    $('pSizeNum').textContent = v;
    withBlock(id, function(b){ b.style.size = v; });
  });

  el = $('pMargin');
  if (el) el.addEventListener('input', function(){
    var v = clamp(this.value, 0, 60);
    $('pMarginNum').textContent = v;
    withBlock(id, function(b){ b.style.marginBottom = v; });
  });

  el = $('pPosX');
  if (el) el.addEventListener('input', function(){
    var v = clamp(this.value, 0, 100);
    $('pPosXNum').textContent = v + '%';
    withBlock(id, function(b){ b.style.x = v; });
  });

  el = $('pPosY');
  if (el) el.addEventListener('input', function(){
    var v = clamp(this.value, 0, 100);
    $('pPosYNum').textContent = v + '%';
    withBlock(id, function(b){ b.style.y = v; });
  });

  el = $('pBoxW');
  if (el) el.addEventListener('input', function(){
    var v = clamp(this.value, 60, maxBoxW());
    $('pBoxWNum').textContent = v;
    withBlock(id, function(b){ b.style.w = v; });
  });

  el = $('pBoxWAuto');
  if (el) el.addEventListener('click', function(){
    withBlock(id, function(b){ delete b.style.w; });
    renderProps();
  });

  el = $('pPosCenter');
  if (el) el.addEventListener('click', function(){
    withBlock(id, function(b){ b.style.x = 50; b.style.y = 50; });
    if ($('pPosX')) $('pPosX').value = 50;
    if ($('pPosY')) $('pPosY').value = 50;
    if ($('pPosXNum')) $('pPosXNum').textContent = '50%';
    if ($('pPosYNum')) $('pPosYNum').textContent = '50%';
  });

  el = $('pOffX');
  if (el) el.addEventListener('input', function(){
    var v = clamp(this.value, -200, 200);
    $('pOffXNum').textContent = v;
    withBlock(id, function(b){ if (v) b.style.offsetX = v; else delete b.style.offsetX; });
  });

  el = $('pOffY');
  if (el) el.addEventListener('input', function(){
    var v = clamp(this.value, -200, 200);
    $('pOffYNum').textContent = v;
    withBlock(id, function(b){ if (v) b.style.offsetY = v; else delete b.style.offsetY; });
  });

  el = $('pOffReset');
  if (el) el.addEventListener('click', function(){
    withBlock(id, function(b){ delete b.style.offsetX; delete b.style.offsetY; });
    if ($('pOffX')) $('pOffX').value = 0;
    if ($('pOffY')) $('pOffY').value = 0;
    if ($('pOffXNum')) $('pOffXNum').textContent = '0';
    if ($('pOffYNum')) $('pOffYNum').textContent = '0';
  });

  var sws = p.querySelectorAll('.sw[data-col]');
  for (var i = 0; i < sws.length; i++) {
    (function(sw){
      sw.addEventListener('click', function(){
        var v = sw.getAttribute('data-col');
        withBlock(id, function(b){ b.style.color = v; });
        renderProps();
      });
    })(sws[i]);
  }

  el = $('pColHex');
  if (el) el.addEventListener('input', function(){
    var v = this.value.trim();
    withBlock(id, function(b){ if (v) b.style.color = v; else delete b.style.color; });
  });
  el = $('pColPick');
  if (el) el.addEventListener('input', function(){
    var v = this.value;
    withBlock(id, function(b){ b.style.color = v; });
    if ($('pColHex')) $('pColHex').value = v;
  });

  el = $('pWeight');
  if (el) el.addEventListener('change', function(){
    var v = Number(this.value);
    withBlock(id, function(b){ b.style.weight = v; });
  });

  var als = p.querySelectorAll('[data-align]');
  for (var j = 0; j < als.length; j++) {
    (function(btn){
      btn.addEventListener('click', function(){
        var v = btn.getAttribute('data-align');
        withBlock(id, function(b){ b.style.align = v; });
        renderProps();
      });
    })(als[j]);
  }

  el = $('pVisible');
  if (el) el.addEventListener('change', function(){
    var on = this.checked;
    withBlock(id, function(b){ if (on) delete b.visible; else b.visible = false; });
  });

  el = $('pFit');
  if (el) el.addEventListener('change', function(){
    var on = this.checked;
    withBlock(id, function(b){ if (on) b.fit = true; else delete b.fit; });
  });

  el = $('pDelete');
  if (el) el.addEventListener('click', function(){ deleteBlock(id); });
}

function deleteBlock(id){
  var f = findBlock(id);
  if (!f) return;
  mutate(function(d){
    var arr = d.regions[f.region];
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { arr.splice(i, 1); return; }
    throw new Error('block not found');
  });
  selectedId = null;
  renderTree();
  renderProps();
}

// ------------------------------------------------ theme + fields (no selection)
function docPanelHtml(){
  var t = doc.theme;
  var h = '<div class="sec"><h3>Theme</h3>';
  for (var i = 0; i < THEME_KEYS.length; i++) {
    var k = THEME_KEYS[i];
    h += '<div class="fld"><label>' + k + '</label><div class="inline">'
      + '<input id="th_' + k + '" value="' + esc(t[k]) + '">'
      + '<input type="color" id="thp_' + k + '" value="' + esc(/^#[0-9a-fA-F]{6}$/.test(t[k]) ? t[k] : '#000000') + '">'
      + '</div></div>';
  }
  h += '<div class="fld"><label>Font</label><input id="th_font" value="' + esc(t.font) + '"></div>'
    + '<div class="hint">Blocks can reference these keys by name, so changing a theme colour restyles everything at once.</div>'
    + '</div>';

  h += '<div class="sec"><h3>Canvas</h3><div class="inline">'
    + '<input id="cvW" type="number" value="' + doc.canvas.width + '">'
    + '<input id="cvH" type="number" value="' + doc.canvas.height + '"></div></div>';

  h += '<div class="sec"><h3>Fields</h3>';
  var keys = fieldKeys();
  if (!keys.length) {
    h += '<div class="empty">No fields yet. Fields are the JSON contract callers send to /render.</div>';
  } else {
    h += '<div class="frow" style="color:var(--dim);font-size:10px;text-transform:uppercase;letter-spacing:.06em">'
      + '<span>key</span><span>label</span><span>type</span><span>default</span><span></span></div>';
    for (var j = 0; j < keys.length; j++) {
      var k2 = keys[j], f = doc.fields[k2];
      var types = ['text','number','image','list'];
      var to = '';
      for (var m = 0; m < types.length; m++) {
        to += '<option value="' + types[m] + '"' + (f.type === types[m] ? ' selected' : '') + '>' + types[m] + '</option>';
      }
      var dv = f.default;
      if (dv === undefined || dv === null) dv = '';
      else if (typeof dv === 'object') { try { dv = JSON.stringify(dv); } catch (e) { dv = ''; } }
      h += '<div class="frow" data-key="' + esc(k2) + '">'
        + '<input class="fkey" value="' + esc(k2) + '">'
        + '<input class="flabel" value="' + esc(f.label || k2) + '">'
        + '<select class="ftype">' + to + '</select>'
        + '<input class="fdef" value="' + esc(dv) + '">'
        + '<button class="ghost x" data-del="' + esc(k2) + '" title="Remove field">\\u00d7</button>'
        + '</div>';
    }
  }
  h += '<button class="ghost addbtn" id="addField">+ Add field</button></div>';

  h += '<div class="sec"><div class="empty">Select a block on the left to edit it.</div></div>';
  return h;
}

function wireDocPanel(){
  var p = $('props');
  for (var i = 0; i < THEME_KEYS.length; i++) {
    (function(k){
      var txt = $('th_' + k), pick = $('thp_' + k);
      if (txt) txt.addEventListener('input', function(){
        var v = this.value.trim();
        if (!v) return;
        mutate(function(d){ d.theme[k] = v; });
        if (pick && /^#[0-9a-fA-F]{6}$/.test(v)) pick.value = v;
      });
      if (pick) pick.addEventListener('input', function(){
        var v = this.value;
        mutate(function(d){ d.theme[k] = v; });
        if (txt) txt.value = v;
      });
    })(THEME_KEYS[i]);
  }
  var fo = $('th_font');
  if (fo) fo.addEventListener('input', function(){
    var v = this.value;
    mutate(function(d){ d.theme.font = v; });
  });

  var cw = $('cvW'), ch = $('cvH');
  if (cw) cw.addEventListener('change', function(){
    var v = clamp(this.value, 32, 8000);
    mutate(function(d){ d.canvas.width = Math.round(v); });
    fitPreview();
  });
  if (ch) ch.addEventListener('change', function(){
    var v = clamp(this.value, 32, 8000);
    mutate(function(d){ d.canvas.height = Math.round(v); });
    fitPreview();
  });

  var rows = p.querySelectorAll('.frow[data-key]');
  for (var j = 0; j < rows.length; j++) {
    (function(row){
      var key = row.getAttribute('data-key');
      var kEl = row.querySelector('.fkey');
      var lEl = row.querySelector('.flabel');
      var tEl = row.querySelector('.ftype');
      var dEl = row.querySelector('.fdef');
      var xEl = row.querySelector('[data-del]');

      kEl.addEventListener('change', function(){
        var nk = this.value.trim();
        if (!nk || nk === key) { this.value = key; return; }
        if (doc.fields[nk]) { toast('Field "' + nk + '" already exists'); this.value = key; return; }
        renameField(key, nk);
      });
      lEl.addEventListener('input', function(){
        var v = this.value;
        mutate(function(d){ if (d.fields[key]) d.fields[key].label = v; });
      });
      tEl.addEventListener('change', function(){
        var v = this.value;
        mutate(function(d){ if (d.fields[key]) d.fields[key].type = v; });
        renderProps();
        renderMediaRow();
      });
      dEl.addEventListener('input', function(){
        var raw = this.value;
        mutate(function(d){
          var f = d.fields[key];
          if (!f) return;
          if (f.type === 'number') f.default = raw === '' ? 0 : Number(raw);
          else if (f.type === 'list') { try { f.default = JSON.parse(raw); } catch (e) { return; } }
          else f.default = raw;
        });
      });
      xEl.addEventListener('click', function(){
        mutate(function(d){ delete d.fields[key]; });
        renderProps();
        renderMediaRow();
      });
    })(rows[j]);
  }

  var af = $('addField');
  if (af) af.addEventListener('click', function(){
    var base = 'field', n = 1;
    while (doc.fields[base + n]) n++;
    var key = base + n;
    mutate(function(d){ d.fields[key] = { type:'text', label:'Field ' + n, default:'' }; });
    renderProps();
    renderMediaRow();
  });
}

function renameField(oldKey, newKey){
  mutate(function(d){
    var next = {};
    var keys = Object.keys(d.fields);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === oldKey) next[newKey] = d.fields[k];
      else next[k] = d.fields[k];
    }
    d.fields = next;
    for (var r = 0; r < ALL_REGIONS.length; r++) {
      var arr = d.regions[ALL_REGIONS[r]];
      if (!Array.isArray(arr)) continue;
      arr.forEach(function(b){ if (b.bind === oldKey) b.bind = newKey; });
    }
    if (d.media && d.media.bind === oldKey) d.media.bind = newKey;
  });
  renderProps();
  renderMediaRow();
}

// ------------------------------------------------------------------ save/load
function save(){
  if (!doc) return Promise.resolve(false);
  $('state').className = 'state';
  $('state').textContent = 'Saving\\u2026';
  return fetch('/api/templates/' + encodeURIComponent(TPL_NAME), {
    method: 'PUT',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ doc: doc })
  }).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ return { ok: r.ok, j: j }; }); })
    .then(function(res){
      if (res.ok && (!res.j || res.j.error === undefined)) {
        markDirty(false);
        $('state').className = 'state ok';
        $('state').textContent = 'Saved';
        setTimeout(function(){ if (!dirty) markDirty(false); }, 1400);
        return true;
      }
      markDirty(true);
      toast('Save failed' + (res.j && res.j.error ? ': ' + res.j.error : ''));
      return false;
    })
    .catch(function(){ markDirty(true); toast('Save failed'); return false; });
}

function renderPng(){
  var btn = $('renderBtn');
  btn.disabled = true;
  btn.textContent = 'Rendering\\u2026';
  save().then(function(){
    return fetch('/render', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ template: TPL_NAME, data: sampleData() })
    });
  }).then(function(r){ return r.json(); })
    .then(function(j){
      if (j && j.url) showModal(j.url);
      else toast('Render failed' + (j && j.error ? ': ' + j.error : ''));
    })
    .catch(function(){ toast('Render failed'); })
    .then(function(){ btn.disabled = false; btn.textContent = 'Render PNG'; });
}

function showModal(url){
  var m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = '<div class="box"><img src="' + esc(url) + '">'
    + '<div class="mrow"><a href="' + esc(url) + '" target="_blank">' + esc(url) + '</a>'
    + '<span style="flex:1"></span><button class="ghost" data-close="1">Close</button></div></div>';
  m.addEventListener('click', function(e){
    if (e.target === m || (e.target.getAttribute && e.target.getAttribute('data-close'))) {
      if (m.parentNode) m.parentNode.removeChild(m);
    }
  });
  document.body.appendChild(m);
}

// ==========================================================================
// DIRECT MANIPULATION — click / type / drag on the preview itself.
//
// Everything here lives INSIDE the iframe document: listeners, outlines,
// guides, toolbar, handles. The iframe is CSS-scaled on the parent side, but
// events raised inside it report doc-space coordinates, so no coordinate
// conversion is needed for iframe-sourced events (parent-sourced ones go
// through docPt(), used when a drag leaves the iframe).
//
// The srcdoc is replaced wholesale on every refresh, so all bindings are
// re-created on the iframe's load event and selection is re-found by id.
// ==========================================================================
var SNAP = 6;          // snap threshold, doc px
var REG_PAD_X = 20;    // region hit box expansion
var REG_PAD_Y = 8;     // (vertical too, else an empty 0-height region is untargetable)
var PAD = 56;          // renderBlockTemplate's canvas padding

var PREVIEW_CSS =
  '.rk-sel{outline:1.5px solid #F5A524 !important;outline-offset:0 !important;'
+ 'box-shadow:inset 0 0 0 1px rgba(255,255,255,.55) !important;}'
+ '.rk-editing{white-space:pre-wrap;cursor:text !important;}'
+ '.rk-ghosting{opacity:.4 !important;}'
+ '.rk-flash{outline:2px solid #F5A524 !important;}'
+ '.rk-ui{position:absolute;z-index:2147483000;}'
+ 'html.rk-drag,html.rk-drag *{cursor:grabbing !important;user-select:none !important;}'
+ 'body img{-webkit-user-drag:none;}'
+ '.rk-tb{background:#1A2029;border:1px solid #2A3340;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.5);'
+ 'display:flex;align-items:center;gap:2px;padding:3px 4px;white-space:nowrap;transform-origin:0 0;'
+ 'font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#F2F5F8;}'
+ '.rk-tb button{background:transparent;border:0;color:#F2F5F8;font-size:12px;font-weight:700;line-height:1;'
+ 'padding:5px 6px;border-radius:5px;cursor:pointer;font-family:inherit;}'
+ '.rk-tb button:hover{background:#2A3340;}'
+ '.rk-tb button.on{background:#F5A524;color:#1c1302;}'
+ '.rk-tb .rk-sw{width:15px;height:15px;border-radius:4px;border:1px solid #3a4658;padding:0;cursor:pointer;}'
+ '.rk-tb .rk-sw.on{border-color:#F5A524;box-shadow:0 0 0 2px rgba(245,165,36,.45);}'
+ '.rk-tb .rk-num{font-size:11px;color:#9AA5B1;min-width:34px;text-align:center;'
+ 'font-family:ui-monospace,Menlo,monospace;}'
+ '.rk-tb .rk-sep{width:1px;height:15px;background:#2A3340;margin:0 3px;}'
+ '.rk-tb select{background:#0e1118;color:#F2F5F8;border:1px solid #2A3340;border-radius:5px;'
+ 'font-size:11px;padding:3px 4px;font-family:inherit;cursor:pointer;}'
// the corner grip outranks the width bar wherever the two would overlap
+ '.rk-handle{background:#F5A524;border:1px solid #1A2029;border-radius:2px;cursor:nwse-resize;'
+ 'transform-origin:0 0;width:10px;height:10px;z-index:2147483001;}'
+ '.rk-whandle{background:#F5A524;border:1px solid #1A2029;border-radius:3px;cursor:ew-resize;'
+ 'transform-origin:0 0;width:6px;}'
+ '.rk-guide{background:#F5A524;opacity:.85;pointer-events:none;}'
+ '.rk-ins{background:#F5A524;border-radius:2px;pointer-events:none;}'
+ '.rk-gh{border:1.5px solid #F5A524;background:rgba(245,165,36,.10);border-radius:3px;pointer-events:none;}'
// A divider is a 2px border and nothing else, which is untargetable once the
// preview is scaled down. This gives it an invisible 16px hit strip. It lives
// only in the editor's injected stylesheet, so rendered output is unaffected.
+ '[data-btype="divider"]{position:relative;}'
+ '[data-btype="divider"]::after{content:"";position:absolute;left:0;right:0;top:-7px;height:16px;}';

function cvW(){ return (doc && doc.canvas) ? doc.canvas.width : 1200; }
function cvH(){ return (doc && doc.canvas) ? doc.canvas.height : 630; }
function r1(n){ return Math.round(n * 10) / 10; }
// overlay chrome is drawn in doc space but should read at screen size, so it is
// counter-scaled by the inverse of the preview's CSS scale.
function uiK(){
  var k = 1 / (previewScale || 1);
  if (!isFinite(k) || k <= 0) k = 1;
  return Math.max(1, Math.min(4, k));
}

// ------------------------------------------------------------ iframe binding
function onFrameLoad(){
  try { fdoc = frameDocument(); fwin = $('frame').contentWindow; }
  catch (e) { fdoc = null; fwin = null; return; }
  if (!fdoc || !fdoc.body) return;
  editing = null; pend = null; gest = null;
  if (!fdoc.getElementById('rk-style')) {
    var st = fdoc.createElement('style');
    st.id = 'rk-style';
    st.textContent = PREVIEW_CSS;
    (fdoc.head || fdoc.documentElement).appendChild(st);
  }
  fdoc.addEventListener('mousedown', onPvDown, true);
  fdoc.addEventListener('dblclick', onPvDbl, true);
  fdoc.addEventListener('keydown', onPvKey, true);
  syncPreview();
}

function frameDocument(){
  var f = $('frame');
  return f ? (f.contentDocument || (f.contentWindow && f.contentWindow.document)) : null;
}

// The outermost element carrying an id: for floating blocks that is the
// positioned wrapper, which is what we select, outline and move.
function pvEl(id){
  if (!fdoc || !id) return null;
  try { return fdoc.querySelector('[data-bid="' + id + '"]'); } catch (e) { return null; }
}
// The block's own root (inside the float wrapper / nudge wrapper, if any).
function pvRoot(id){
  var e = pvEl(id);
  if (!e) return null;
  if (e.getAttribute('data-float')) {
    var inner = e.querySelector('[data-bid]');
    if (inner) return inner;
  }
  return e;
}
// Width the block currently occupies in the preview, if the preview is live.
function renderedWidthOf(id){
  var e = pvEl(id);
  if (!e) return null;
  var w = Math.round(e.getBoundingClientRect().width);
  return w > 0 ? w : null;
}
function removeUi(id){
  if (!fdoc) return;
  var e = fdoc.getElementById(id);
  if (e && e.parentNode) e.parentNode.removeChild(e);
}

// ------------------------------------------------------------ selection paint
function syncPreview(){
  if (!fdoc || !fdoc.body || !doc) return;
  var prev = fdoc.querySelectorAll('.rk-sel');
  for (var i = 0; i < prev.length; i++) prev[i].classList.remove('rk-sel');
  removeUi('rk-tb');
  removeUi('rk-handle');
  removeUi('rk-whandle');
  if (!selectedId) return;
  var el = pvEl(selectedId);
  if (!el) return;
  el.classList.add('rk-sel');
  if (editing) return;
  buildToolbar(selectedId, el);
  buildHandle(selectedId, el);
  buildWidthHandle(selectedId, el);
}

// ---------------------------------------------------------------- toolbar
function buildToolbar(id, el){
  var f = findBlock(id);
  if (!f) return;
  var b = f.block, t = b.type, st = b.style || {};
  var h = '';
  if (t !== 'divider' && t !== 'list') {
    var lab = t === 'spacer' ? 'Ht' : (t === 'image' ? 'Box' : 'Sz');
    var sz = clamp(st.size === undefined ? 24 : st.size, 10, 140);
    h += '<button data-tb="size-" title="Smaller">\\u2212</button>'
      + '<span class="rk-num">' + lab + ' ' + (t === 'image' ? sz * 4 : sz) + '</span>'
      + '<button data-tb="size+" title="Larger">+</button><span class="rk-sep"></span>';
  }
  if (t === 'text' || t === 'badge') {
    var ws = [400, 600, 700, 800], wo = '';
    for (var i = 0; i < ws.length; i++) {
      wo += '<option value="' + ws[i] + '"' + ((st.weight || 400) === ws[i] ? ' selected' : '') + '>' + ws[i] + '</option>';
    }
    h += '<select data-tb="weight">' + wo + '</select><span class="rk-sep"></span>';
  }
  for (var c = 0; c < THEME_KEYS.length; c++) {
    var k = THEME_KEYS[c];
    h += '<button class="rk-sw' + (st.color === k ? ' on' : '') + '" data-tb="col:' + k + '"'
      + ' title="' + k + '" style="background:' + esc(doc.theme[k]) + '"></button>';
  }
  h += '<span class="rk-sep"></span>';
  if (t === 'text' || t === 'image' || t === 'badge' || t === 'stars') {
    var al = st.align || 'left';
    h += '<button data-tb="al:left" class="' + (al === 'left' ? 'on' : '') + '">L</button>'
      + '<button data-tb="al:center" class="' + (al === 'center' ? 'on' : '') + '">C</button>'
      + '<button data-tb="al:right" class="' + (al === 'right' ? 'on' : '') + '">R</button>'
      + '<span class="rk-sep"></span>';
  }
  h += '<button data-tb="del" title="Delete block">\\u2715</button>';

  var tb = fdoc.createElement('div');
  tb.id = 'rk-tb';
  tb.className = 'rk-ui rk-tb';
  tb.innerHTML = h;
  fdoc.body.appendChild(tb);
  tb.addEventListener('mousedown', function(e){ e.stopPropagation(); });
  tb.addEventListener('click', function(e){
    var btn = e.target.closest ? e.target.closest('[data-tb]') : null;
    if (!btn || btn.tagName === 'SELECT') return;
    e.preventDefault();
    e.stopPropagation();
    toolbarAction(id, btn.getAttribute('data-tb'));
  });
  var sel = tb.querySelector('select[data-tb="weight"]');
  if (sel) sel.addEventListener('change', function(){
    var v = Number(this.value);
    withBlock(id, function(x){ x.style.weight = v; });
    renderProps();
  });
  positionToolbar(tb, el);
}

function positionToolbar(tb, el){
  var k = uiK();
  var r = el.getBoundingClientRect();
  tb.style.transform = 'scale(' + k + ')';
  var w = tb.offsetWidth * k, hh = tb.offsetHeight * k;
  var left = r.left + r.width / 2 - w / 2;
  left = Math.max(4, Math.min(Math.max(4, cvW() - w - 4), left));
  var top = r.top - hh - 8 * k;
  if (r.top < 60 || top < 0) top = r.bottom + 8 * k;
  tb.style.left = Math.round(left) + 'px';
  tb.style.top = Math.round(top) + 'px';
}

function toolbarAction(id, act){
  var f = findBlock(id);
  if (!f) return;
  if (act === 'del') { deleteBlock(id); return; }
  if (act === 'size-' || act === 'size+') {
    var st = f.block.style || {};
    var cur = st.size === undefined ? 24 : Number(st.size);
    var nv = clamp(Math.round(cur) + (act === 'size+' ? 2 : -2), 10, 140);
    withBlock(id, function(x){ x.style.size = nv; });
    renderProps();
    return;
  }
  if (act.indexOf('col:') === 0) {
    var c = act.slice(4);
    withBlock(id, function(x){ x.style.color = c; });
    renderProps();
    return;
  }
  if (act.indexOf('al:') === 0) {
    var a = act.slice(3);
    withBlock(id, function(x){ x.style.align = a; });
    renderProps();
  }
}

// ---------------------------------------------------------------- resize grip
function buildHandle(id, el){
  var f = findBlock(id);
  if (!f || f.block.type === 'divider') return;
  var k = uiK();
  var hd = fdoc.createElement('div');
  hd.id = 'rk-handle';
  hd.className = 'rk-ui rk-handle';
  hd.style.transform = 'scale(' + k + ')';
  fdoc.body.appendChild(hd);
  var r = el.getBoundingClientRect();
  hd.style.left = (r.right - 5 * k) + 'px';
  hd.style.top = (r.bottom - 5 * k) + 'px';
  hd.addEventListener('mousedown', function(e){
    e.preventDefault();
    e.stopPropagation();
    startResize(id, e);
  });
}

// Box width is a floating-block idea only: flow blocks are sized by their
// region. Distinct bar, distinct axis, distinct cursor from the corner grip.
function buildWidthHandle(id, el){
  var f = findBlock(id);
  if (!f || f.region !== 'floating') return;
  var k = uiK();
  var r = el.getBoundingClientRect();
  // Leave room for the corner grip on short blocks — otherwise a 28px bar
  // centred on a one-line block covers the bottom-right corner entirely.
  var barH = clamp(Math.min(28, r.height / k - 14), 10, 28);
  var wh = fdoc.createElement('div');
  wh.id = 'rk-whandle';
  wh.className = 'rk-ui rk-whandle';
  wh.style.height = barH + 'px';
  wh.style.transform = 'scale(' + k + ')';
  wh.title = 'Drag to set box width \\u00b7 double-click for auto width';
  fdoc.body.appendChild(wh);
  wh.style.left = (r.right - 3 * k) + 'px';
  wh.style.top = (r.top + r.height / 2 - (barH * k) / 2) + 'px';
  wh.addEventListener('mousedown', function(e){
    e.preventDefault();
    e.stopPropagation();
    // Double-click is detected by timing rather than the dblclick event: a
    // committed resize rebuilds this element, so the browser's own dblclick
    // pairing cannot be relied on.
    var now = Date.now();
    if (lastWhDown.id === id && now - lastWhDown.t < 350) {
      lastWhDown = { id: null, t: 0 };
      withBlock(id, function(b){ delete b.style.w; });
      renderProps();
      return;
    }
    lastWhDown = { id: id, t: now };
    startWidthResize(id, e);
  });
}
var lastWhDown = { id: null, t: 0 };

// ------------------------------------------------------------ snapping/guides
// Fresh candidate set per gesture: canvas centre/edges/padding lines plus every
// other visible block's left/centre/right and top/centre/bottom.
function buildCands(excludeId){
  var W = cvW(), H = cvH();
  var xs = [0, PAD, W / 2, W - PAD, W];
  var ys = [0, PAD, H / 2, H - PAD, H];
  if (fdoc) {
    var seen = {}, list = fdoc.querySelectorAll('[data-bid]');
    for (var i = 0; i < list.length; i++) {
      var id = list[i].getAttribute('data-bid');
      if (seen[id]) continue;
      seen[id] = 1;
      if (id === excludeId) continue;
      var r = list[i].getBoundingClientRect();
      if (!r.width && !r.height) continue;
      xs.push(r.left, r.left + r.width / 2, r.right);
      ys.push(r.top, r.top + r.height / 2, r.bottom);
    }
  }
  return { xs: xs, ys: ys };
}

function snapAxis(pos, size, cands){
  var edges = [pos, pos + size / 2, pos + size];
  var offs = [0, size / 2, size];
  var best = null;
  for (var i = 0; i < cands.length; i++) {
    for (var j = 0; j < 3; j++) {
      var d = Math.abs(cands[i] - edges[j]);
      if (d <= SNAP && (!best || d < best.d)) best = { d: d, pos: cands[i] - offs[j], line: cands[i] };
    }
  }
  return best;
}

function snapPos(left, top, w, h, cands, disabled){
  if (disabled) return { left: left, top: top, gx: null, gy: null };
  var sx = snapAxis(left, w, cands.xs);
  var sy = snapAxis(top, h, cands.ys);
  return {
    left: sx ? sx.pos : left, top: sy ? sy.pos : top,
    gx: sx ? sx.line : null, gy: sy ? sy.line : null
  };
}

function showGuides(gx, gy){
  guideLine('rk-gx', gx, true);
  guideLine('rk-gy', gy, false);
}
function guideLine(id, v, vertical){
  if (!fdoc) return;
  if (v === null || v === undefined) { removeUi(id); return; }
  var el = fdoc.getElementById(id);
  if (!el) {
    el = fdoc.createElement('div');
    el.id = id;
    el.className = 'rk-ui rk-guide';
    fdoc.body.appendChild(el);
  }
  var t = Math.max(1, uiK());
  if (vertical) {
    el.style.left = (v - t / 2) + 'px'; el.style.top = '0px';
    el.style.width = t + 'px'; el.style.height = cvH() + 'px';
  } else {
    el.style.top = (v - t / 2) + 'px'; el.style.left = '0px';
    el.style.height = t + 'px'; el.style.width = cvW() + 'px';
  }
}
function clearGuides(){ removeUi('rk-gx'); removeUi('rk-gy'); }
function clearIns(){ removeUi('rk-ins'); }

// ------------------------------------------------------------- flow regions
function flowRegions(){ return ['top', 'middle', 'bottom']; }

// The visual extent of a block: the union of its content's client rects. A
// badge or image root is a full-width flex container holding a small pill or
// img, and a text div is full-width regardless of how short the line is, so a
// bounding box would claim canvas the block does not visually occupy. A Range
// over the contents reports the glyph/child boxes instead. Falls back to the
// element box for blocks with no contents (divider, spacer).
function contentRect(el){
  var box = null;
  try {
    var rg = fdoc.createRange();
    rg.selectNodeContents(el);
    var rects = rg.getClientRects();
    for (var i = 0; i < rects.length; i++) {
      if (!rects[i].width && !rects[i].height) continue;
      box = box ? unionRect(box, rects[i]) : rectOf(rects[i]);
    }
  } catch (e) { box = null; }
  return box || rectOf(el.getBoundingClientRect());
}
function rectOf(r){ return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }
function boxRect(b){
  return { left: b.left, top: b.top, right: b.right, bottom: b.bottom,
    width: b.right - b.left, height: b.bottom - b.top };
}
function unionRect(a, r){
  return {
    left: Math.min(a.left, r.left), top: Math.min(a.top, r.top),
    right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom)
  };
}

// Hit-testing uses a region's CONTENT bounds, never its container. The three
// containers tile the entire canvas (middle is flex:1), so container bounds
// would leave no space that is "outside every region" and pull-out-to-float
// could never fire.
function regionBox(regEl){
  var kids = childBlockEls(regEl);
  var cr = regEl.getBoundingClientRect();
  if (!kids.length) {
    // An empty region still has to be droppable, but an empty middle region is
    // canvas-tall — cap it to a modest strip centred on the container.
    var hgt = Math.min(cr.height, 40);
    var mid = cr.top + cr.height / 2;
    return { left: cr.left, right: cr.right, top: mid - hgt / 2, bottom: mid + hgt / 2, empty: true };
  }
  var box = null;
  for (var i = 0; i < kids.length; i++) {
    var c = contentRect(kids[i].el);
    box = box ? unionRect(box, c) : c;
  }
  box.empty = false;
  return box;
}

function regionHit(p){
  if (!fdoc) return null;
  var regs = fdoc.querySelectorAll('[data-region]');
  var best = null;
  for (var i = 0; i < regs.length; i++) {
    var name = regs[i].getAttribute('data-region');
    if (flowRegions().indexOf(name) < 0) continue;
    var box = regionBox(regs[i]);
    if (p.x < box.left - REG_PAD_X || p.x > box.right + REG_PAD_X) continue;
    if (p.y < box.top - REG_PAD_Y || p.y > box.bottom + REG_PAD_Y) continue;
    var h = box.bottom - box.top;
    // the tightest hitbox wins where expanded boxes overlap
    if (!best || h < best.h) {
      best = { name: name, el: regs[i], rect: regs[i].getBoundingClientRect(), box: box, h: h };
    }
  }
  return best;
}

// Direct children of a region that represent a block (the child may be a nudge
// wrapper around the block root).
function childBlockEls(regEl){
  var out = [], ch = regEl.children;
  for (var i = 0; i < ch.length; i++) {
    if (ch[i].classList && ch[i].classList.contains('rk-ui')) continue;
    var b = ch[i].getAttribute('data-bid') ? ch[i] : ch[i].querySelector('[data-bid]');
    // wrap = the flow child (may be a nudge wrapper), el = the block root
    if (b) out.push({ wrap: ch[i], el: b, id: b.getAttribute('data-bid') });
  }
  return out;
}

// DOM order can differ from array order (hidden blocks render nothing), so the
// insertion point is resolved through the id of the block we would land before.
function flowIndex(regEl, name, y){
  var kids = childBlockEls(regEl);
  var arr = regionArr(name);
  for (var i = 0; i < kids.length; i++) {
    var r = kids[i].wrap.getBoundingClientRect();
    if (y < r.top + r.height / 2) return idxOfId(arr, kids[i].id);
  }
  return arr.length;
}
function idxOfId(arr, id){
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return i;
  return arr.length;
}

function showIns(hit, y){
  clearIns();
  var kids = childBlockEls(hit.el);
  var r = hit.rect;                        // container rect: full column width
  // an empty region's line goes on its hit strip, not at the container's top
  var ly = kids.length ? r.top : (hit.box.top + hit.box.bottom) / 2;
  for (var i = 0; i < kids.length; i++) {
    var kr = kids[i].wrap.getBoundingClientRect();
    if (y < kr.top + kr.height / 2) { ly = kr.top; break; }
    ly = kr.bottom;
  }
  var d = fdoc.createElement('div');
  d.id = 'rk-ins';
  d.className = 'rk-ui rk-ins';
  d.style.left = r.left + 'px';
  d.style.width = Math.max(24, r.width) + 'px';
  d.style.top = (ly - 1) + 'px';
  d.style.height = Math.max(2, uiK()) + 'px';
  fdoc.body.appendChild(d);
}

// -------------------------------------------------------------- anchor maths
// Renderer: left = (x/100)*W - (x/100)*blockW  =>  x = leftPx / (W - blockW) * 100.
// A block at least as wide as the canvas has no travel, so it pins to 50.
function pctFor(left, top, w, h){
  var W = cvW(), H = cvH();
  var x = (w >= W) ? 50 : (left / (W - w)) * 100;
  var y = (h >= H) ? 50 : (top / (H - h)) * 100;
  return { x: r1(clamp(x, 0, 100)), y: r1(clamp(y, 0, 100)) };
}
function pxForPct(x, y, w, h){
  var W = cvW(), H = cvH();
  return { left: (w >= W) ? 0 : (x / 100) * (W - w), top: (h >= H) ? 0 : (y / 100) * (H - h) };
}

// -------------------------------------------------------------- pointer flow
function docPt(e, fromParent){
  if (!fromParent) return { x: e.clientX, y: e.clientY };
  var f = $('frame');
  var r = f.getBoundingClientRect();      // already reflects the CSS scale
  var s = previewScale || 1;
  return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
}

function onPvDown(e){
  if (e.button !== 0) return;
  var tgt = e.target;
  if (tgt && tgt.closest && tgt.closest('.rk-ui')) return;
  if (editing) {
    if (editing.el === tgt || (editing.el.contains && editing.el.contains(tgt))) return;
    endEdit();
  }
  var node = (tgt && tgt.closest) ? tgt.closest('[data-bid]') : null;
  e.preventDefault();
  if (fwin) { try { fwin.focus(); } catch (err) {} }
  if (!node) { if (selectedId) select(null); return; }
  var id = node.getAttribute('data-bid');
  var wasSel = (id === selectedId);
  if (!wasSel) select(id);
  pend = { id: id, x: e.clientX, y: e.clientY, wasSel: wasSel };
  attachGestureListeners();
}

function attachGestureListeners(){
  if (fdoc) {
    fdoc.addEventListener('mousemove', onPvMove, true);
    fdoc.addEventListener('mouseup', onPvUp, true);
  }
  // the pointer can leave the iframe mid-drag (that is how you pull a block
  // out of the stack), so the parent document backs the gesture up
  document.addEventListener('mousemove', onDocMove, true);
  document.addEventListener('mouseup', onDocUp, true);
}
function detachGestureListeners(){
  if (fdoc) {
    fdoc.removeEventListener('mousemove', onPvMove, true);
    fdoc.removeEventListener('mouseup', onPvUp, true);
  }
  document.removeEventListener('mousemove', onDocMove, true);
  document.removeEventListener('mouseup', onDocUp, true);
}

function onPvMove(e){ handleMove(docPt(e, false), e); }
function onDocMove(e){ if (!pend && !gest) return; handleMove(docPt(e, true), e); }
function onPvUp(e){ handleUp(docPt(e, false), e); }
function onDocUp(e){ if (!pend && !gest) return; handleUp(docPt(e, true), e); }

function handleMove(p, e){
  if (gest && gest.kind === 'resize') { resizeMove(p, e); return; }
  if (gest && gest.kind === 'width') { widthMove(p, e); return; }
  if (!pend && !gest) return;
  if (!gest) {
    if (Math.abs(p.x - pend.x) <= 4 && Math.abs(p.y - pend.y) <= 4) return;
    startDrag(pend, p);
    if (!gest) { pend = null; detachGestureListeners(); return; }
  }
  dragMove(p, e);
}

function startDrag(pd, p){
  var f = findBlock(pd.id);
  if (!f || !fdoc) return;
  var el = pvEl(pd.id);
  if (!el) return;
  // Floating blocks are dragged by their wrapper, which already shrink-wraps.
  // Flow blocks are full-column-width boxes around (often much narrower)
  // content, so the ghost — and the size the anchor maths uses on conversion —
  // comes from the content bounds. A floating wrapper shrink-wraps to exactly
  // that, so the block lands where the ghost was.
  var r = (f.region === 'floating')
    ? el.getBoundingClientRect()
    : boxRect(contentRect(pvRoot(pd.id) || el));
  fdoc.documentElement.classList.add('rk-drag');
  removeUi('rk-tb');
  removeUi('rk-handle');
  removeUi('rk-whandle');
  var base = {
    id: pd.id, el: el, x0: pd.x, y0: pd.y,
    l0: r.left, t0: r.top, w: r.width, h: r.height,
    cands: buildCands(pd.id), cur: { left: r.left, top: r.top }
  };
  if (f.region === 'floating') {
    // drop the percent transform and drive left/top in px for the duration
    el.style.left = r.left + 'px';
    el.style.top = r.top + 'px';
    el.style.transform = 'translate(0px, 0px)';
    base.kind = 'float';
    gest = base;
  } else {
    el.classList.add('rk-ghosting');
    var gh = fdoc.createElement('div');
    gh.className = 'rk-ui rk-gh';
    gh.style.width = r.width + 'px';
    gh.style.height = r.height + 'px';
    gh.style.left = r.left + 'px';
    gh.style.top = r.top + 'px';
    fdoc.body.appendChild(gh);
    base.kind = 'flow';
    base.gh = gh;
    base.region = f.region;
    gest = base;
  }
}

function dragMove(p, e){
  var g = gest;
  var mod = !!(e && (e.metaKey || e.ctrlKey));
  var nl = g.l0 + (p.x - g.x0), nt = g.t0 + (p.y - g.y0);
  if (g.kind === 'float') {
    var s = snapPos(nl, nt, g.w, g.h, g.cands, mod);
    var pos = clampToCanvas(s.left, s.top, g.w, g.h);
    showGuides(pos.left === s.left ? s.gx : null, pos.top === s.top ? s.gy : null);
    g.el.style.left = pos.left + 'px';
    g.el.style.top = pos.top + 'px';
    g.cur = pos;
    return;
  }
  // flow: inside a region we show an insertion line; outside every region the
  // drop converts the block to floating, so guides come back on.
  var hit = regionHit(p);
  if (hit) {
    clearGuides();
    g.drop = { region: hit.name, index: flowIndex(hit.el, hit.name, p.y) };
    showIns(hit, p.y);
    g.gh.style.left = nl + 'px';
    g.gh.style.top = nt + 'px';
    g.cur = { left: nl, top: nt };
    return;
  }
  clearIns();
  g.drop = null;
  var s2 = snapPos(nl, nt, g.w, g.h, g.cands, mod);
  var pos2 = clampToCanvas(s2.left, s2.top, g.w, g.h);
  showGuides(pos2.left === s2.left ? s2.gx : null, pos2.top === s2.top ? s2.gy : null);
  g.gh.style.left = pos2.left + 'px';
  g.gh.style.top = pos2.top + 'px';
  g.cur = pos2;
}

function clampToCanvas(left, top, w, h){
  var W = cvW(), H = cvH();
  return {
    left: w >= W ? 0 : clamp(left, 0, W - w),
    top: h >= H ? 0 : clamp(top, 0, H - h)
  };
}

function handleUp(p, e){
  var g = gest, pd = pend;
  gest = null; pend = null;
  detachGestureListeners();
  clearGuides();
  clearIns();
  if (fdoc) fdoc.documentElement.classList.remove('rk-drag');
  if (!g) {
    // a plain click on an already-selected text/badge opens inline editing
    if (pd && pd.wasSel && canEdit(pd.id)) beginEdit(pd.id);
    return;
  }
  if (g.kind === 'resize') { commitResize(g); return; }
  if (g.kind === 'width') { commitWidth(g); return; }
  if (g.kind === 'float') {
    var xy = pctFor(g.cur.left, g.cur.top, g.w, g.h);
    withBlock(g.id, function(b){ b.style.x = xy.x; b.style.y = xy.y; });
    renderProps();
    return;
  }
  if (g.gh && g.gh.parentNode) g.gh.parentNode.removeChild(g.gh);
  if (g.el) g.el.classList.remove('rk-ghosting');
  if (g.drop) moveBlock(g.id, g.region, g.drop.region, g.drop.index);
  else convertToFloating(g);
}

// "Pull it out of the stack": a flow block dropped away from every region
// becomes a floating block at the drop point.
function convertToFloating(g){
  var xy = pctFor(g.cur.left, g.cur.top, g.w, g.h);
  var id = g.id, from = g.region;
  mutate(function(d){
    var src = d.regions[from];
    if (!Array.isArray(src)) throw new Error('unknown source region ' + from);
    var i = -1;
    for (var n = 0; n < src.length; n++) if (src[n].id === id) { i = n; break; }
    if (i < 0) throw new Error('block ' + id + ' not found');
    var moved = src.splice(i, 1)[0];
    if (!Array.isArray(d.regions.floating)) d.regions.floating = [];
    if (!moved.style) moved.style = {};
    moved.style.x = xy.x;
    moved.style.y = xy.y;
    d.regions.floating.push(moved);
  });
  select(id);
}

// ------------------------------------------------------------------- resize
function startResize(id, e){
  var f = findBlock(id);
  if (!f || !fdoc) return;
  var el = pvEl(id), root = pvRoot(id);
  if (!el || !root) return;
  var t = f.block.type;
  var img = (t === 'image') ? root.querySelector('img') : null;
  var mr = (img || root).getBoundingClientRect();
  var st = f.block.style || {};
  gest = {
    kind: 'resize', id: id, type: t, el: el, root: root, img: img,
    x0: e.clientX, y0: e.clientY, w0: mr.width, h0: mr.height,
    l0: mr.left, t0: mr.top, size0: clamp(st.size === undefined ? 24 : st.size, 10, 140),
    cands: buildCands(id), size: clamp(st.size === undefined ? 24 : st.size, 10, 140)
  };
  fdoc.documentElement.classList.add('rk-drag');
  removeUi('rk-tb');
  removeUi('rk-handle');
  removeUi('rk-whandle');
  attachGestureListeners();
}

// ---------------------------------------------------------------- box width
function maxBoxW(){ return Math.round(cvW() * 0.92); }   // renderer caps at 92%

function startWidthResize(id, e){
  var f = findBlock(id);
  if (!f || !fdoc || f.region !== 'floating') return;
  var el = pvEl(id);
  if (!el) return;
  var r = el.getBoundingClientRect();
  // Pin the wrapper to px left/top for the gesture: while the percent transform
  // is live, changing the width also moves the left edge (translate(-x%) is a
  // percentage OF THE ELEMENT), so the box would slide as you resized it.
  el.style.left = r.left + 'px';
  el.style.top = r.top + 'px';
  el.style.transform = 'translate(0px, 0px)';
  gest = {
    kind: 'width', id: id, el: el, x0: e.clientX,
    l0: r.left, w0: r.width, w: r.width, cands: buildCands(id),
    // the bar being dragged stays put and tracks the edge — removing it would
    // also break double-click detection, since the second press would land on
    // whatever sat underneath
    wh: fdoc.getElementById('rk-whandle')
  };
  fdoc.documentElement.classList.add('rk-drag');
  removeUi('rk-tb');
  removeUi('rk-handle');
  attachGestureListeners();
}

function widthMove(p, e){
  var g = gest;
  var mod = !!(e && (e.metaKey || e.ctrlKey));
  var nw = g.w0 + (p.x - g.x0);
  if (Math.abs(p.x - g.x0) > 2) g.moved = true;
  if (!mod) {
    // the right edge is the only moving edge, so snap it as a bare point
    var s = snapAxis(g.l0 + nw, 0, g.cands.xs);
    if (s) nw = s.line - g.l0;
    showGuides(s ? s.line : null, null);
  } else clearGuides();
  nw = clamp(Math.round(nw), 60, maxBoxW());
  g.w = nw;
  g.el.style.width = nw + 'px';
  if (g.wh) g.wh.style.left = (g.l0 + nw - 3 * uiK()) + 'px';
}

function commitWidth(g){
  // a press that never moved is a click (or the first half of a double-click),
  // not a resize — committing here would pin w to the current content width
  if (!g.moved) { schedulePreview(); return; }
  var W = cvW();
  var nw = clamp(Math.round(g.w), 60, maxBoxW());
  // A new width means a new pixel position for the same x%, so x is recomputed
  // from the (unchanged) left edge — otherwise the box jumps on refresh.
  var nx = (nw >= W) ? 50 : r1(clamp((g.l0 / (W - nw)) * 100, 0, 100));
  withBlock(g.id, function(b){ b.style.w = nw; b.style.x = nx; });
  renderProps();
}

function resizeMove(p, e){
  var g = gest;
  var mod = !!(e && (e.metaKey || e.ctrlKey));
  var dx = p.x - g.x0, dy = p.y - g.y0;
  var ns;
  if (g.type === 'image') {
    var box0 = g.size0 * 4;
    var nb = box0 + (dx + dy) / 2;
    if (!mod) {
      // the moving edges are right and bottom; snap whichever is closer
      var sx = snapAxis(g.l0 + nb, 0, g.cands.xs);
      var sy = snapAxis(g.t0 + nb, 0, g.cands.ys);
      var pick = (!sx) ? sy : ((!sy || sx.d <= sy.d) ? sx : sy);
      if (pick) nb = pick.line - (pick === sx ? g.l0 : g.t0);
      showGuides(sx ? sx.line : null, sy ? sy.line : null);
    } else clearGuides();
    ns = clamp(Math.round(nb / 4), 10, 140);
    if (g.img) { g.img.style.width = (ns * 4) + 'px'; g.img.style.height = (ns * 4) + 'px'; }
  } else {
    var ratio = g.h0 > 0 ? (g.h0 + dy) / g.h0 : 1;
    ns = clamp(Math.round(g.size0 * ratio), 10, 140);
    if (g.type === 'text' && !mod) ns = snapToPeerTextSize(g.id, ns);
    if (g.type === 'spacer') g.root.style.height = ns + 'px';
    else if (g.type === 'badge') {
      var pill = g.root.querySelector('div') || g.root;
      pill.style.fontSize = ns + 'px';
      pill.style.padding = Math.round(ns * 0.45) + 'px ' + Math.round(ns * 1.1) + 'px';
    } else g.root.style.fontSize = ns + 'px';
  }
  g.size = ns;
}

// Equal-size guide: text sizes within 2px of another text block's size stick to
// it, and that block flashes so the relationship is visible.
function snapToPeerTextSize(id, ns){
  var hit = null;
  for (var r = 0; r < ALL_REGIONS.length; r++) {
    var arr = regionArr(ALL_REGIONS[r]);
    for (var i = 0; i < arr.length; i++) {
      var b = arr[i];
      if (b.id === id || b.type !== 'text') continue;
      var s = (b.style && b.style.size !== undefined) ? Number(b.style.size) : 24;
      if (Math.abs(ns - s) <= 2) { hit = { size: s, id: b.id }; break; }
    }
    if (hit) break;
  }
  if (!hit) return ns;
  flashPeer(hit.id);
  return hit.size;
}
var flashTimer = null;
function flashPeer(id){
  var el = pvEl(id);
  if (!el || el.classList.contains('rk-flash')) return;
  el.classList.add('rk-flash');
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(function(){
    if (!fdoc) return;
    var f = fdoc.querySelectorAll('.rk-flash');
    for (var i = 0; i < f.length; i++) f[i].classList.remove('rk-flash');
  }, 450);
}

function commitResize(g){
  var v = clamp(g.size, 10, 140);
  withBlock(g.id, function(b){ b.style.size = v; });
  renderProps();
}

// -------------------------------------------------------------- inline edit
function canEdit(id){
  var f = findBlock(id);
  return !!f && (f.block.type === 'text' || f.block.type === 'badge');
}

function onPvDbl(e){
  if (editing) return;
  var node = (e.target && e.target.closest) ? e.target.closest('[data-bid]') : null;
  if (!node) return;
  var id = node.getAttribute('data-bid');
  if (!canEdit(id)) return;
  e.preventDefault();
  if (id !== selectedId) select(id);
  beginEdit(id);
}

function beginEdit(id){
  var f = findBlock(id);
  if (!f || !fdoc) return;
  var t = f.block.type;
  if (t !== 'text' && t !== 'badge') return;
  var root = pvRoot(id);
  if (!root) return;
  var el = (t === 'badge') ? (root.querySelector('div') || root) : root;
  editing = { id: id, el: el, type: t };
  removeUi('rk-tb');
  removeUi('rk-handle');
  removeUi('rk-whandle');
  el.setAttribute('contenteditable', 'true');
  el.setAttribute('spellcheck', 'false');
  el.classList.add('rk-editing');
  el.addEventListener('input', onEditInput);
  el.addEventListener('paste', onEditPaste);
  el.addEventListener('blur', onEditBlur);
  try { el.focus(); } catch (e1) {}
  try {
    var rg = fdoc.createRange();
    rg.selectNodeContents(el);
    var sl = fwin.getSelection();
    sl.removeAllRanges();
    sl.addRange(rg);
  } catch (e2) {}
}

// Commits on every keystroke, but the preview refresh stays suppressed and the
// properties panel is left alone so focus and caret survive.
function onEditInput(){
  if (!editing) return;
  var txt = editing.el.textContent;
  var f = findBlock(editing.id);
  if (!f) return;
  var key = f.block.bind;
  if (key && doc.fields && doc.fields[key]) {
    mutate(function(d){
      var fd = d.fields[key];
      if (!fd) throw new Error('field ' + key + ' missing');
      fd.default = txt;
    });
  } else {
    withBlock(editing.id, function(b){ b.value = txt; });
  }
}

function onEditPaste(e){
  e.preventDefault();
  var txt = '';
  try { txt = (e.clipboardData || fwin.clipboardData).getData('text/plain'); } catch (err) { txt = ''; }
  insertPlain(String(txt || '').replace(/\\r\\n?/g, '\\n'));
}

// Plain-text insertion done by hand: execCommand('insertText') silently drops
// newlines, and it is the one path that must never introduce markup.
function insertPlain(txt){
  if (!txt || !editing) return;
  try {
    var sel = fwin.getSelection();
    if (!sel || !sel.rangeCount) return;
    var rg = sel.getRangeAt(0);
    if (!editing.el.contains(rg.commonAncestorContainer)) return;
    rg.deleteContents();
    var node = fdoc.createTextNode(txt);
    rg.insertNode(node);
    // caret INSIDE the new node — setStartAfter leaves it on a node boundary
    // that Chrome resolves back into the preceding text node when you type
    rg.setStart(node, node.nodeValue.length);
    rg.collapse(true);
    sel.removeAllRanges();
    sel.addRange(rg);
  } catch (err) { return; }
  onEditInput();   // programmatic edits raise no input event
}

function onEditBlur(){ if (editing) endEdit(); }

function endEdit(){
  if (!editing) return;
  var el = editing.el;
  editing = null;
  el.removeEventListener('input', onEditInput);
  el.removeEventListener('paste', onEditPaste);
  el.removeEventListener('blur', onEditBlur);
  el.removeAttribute('contenteditable');
  el.classList.remove('rk-editing');
  try { if (fwin) fwin.getSelection().removeAllRanges(); } catch (e) {}
  syncPreview();
  schedulePreview();
}

// --------------------------------------------------------- keys in the frame
function onPvKey(e){
  if (editing) {
    if (e.key === 'Escape') { e.preventDefault(); endEdit(); return; }
    if (e.key === 'Enter' && e.shiftKey) {
      // insertLineBreak drops a literal \\n into a pre-wrap contenteditable and
      // leaves the caret after it; insertText and hand-built text nodes both
      // end up with the caret normalised back into the preceding node.
      e.preventDefault();
      try { fdoc.execCommand('insertLineBreak'); } catch (err) {}
      onEditInput();
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); endEdit(); return; }
    if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); endEdit(); save(); }
    return;
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(); return; }
  if (e.key === 'Escape') { e.preventDefault(); if (selectedId) select(null); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
    e.preventDefault();
    deleteBlock(selectedId);
  }
}

function boot(){
  fetch('/api/templates/' + encodeURIComponent(TPL_NAME))
    .then(function(r){ return r.json(); })
    .then(function(j){
      if (j && j.doc) return j.doc;
      if (j && j.kind === 'block') return j;
      return defaultDoc();
    })
    .catch(function(){ return defaultDoc(); })
    .then(function(d){
      doc = normalize(d);
      renderPresetRow();
      renderMediaRow();
      renderTree();
      renderProps();
      markDirty(false);
      refreshPreview();
    });
}

document.addEventListener('keydown', function(e){
  var el = e.target;
  var tag = (el && el.tagName ? el.tagName : '').toLowerCase();
  var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || (el && el.isContentEditable);
  if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(); return; }
  if (e.key === 'Escape') { closePalette(); if (editing) endEdit(); return; }
  if (!typing && selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
    e.preventDefault();
    deleteBlock(selectedId);
  }
});

window.addEventListener('beforeunload', function(e){
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = '';
  return '';
});

window.addEventListener('resize', fitPreview);
document.addEventListener('dragover', function(e){ if (dragging) e.preventDefault(); });
document.addEventListener('drop', function(e){
  if (!dragging) return;
  e.preventDefault();
  clearIndicators();
  dragging = null;
  renderTree();
});

$('saveBtn').addEventListener('click', function(){ save(); });
$('renderBtn').addEventListener('click', renderPng);
$('props').addEventListener('mousedown', function(e){ e.stopPropagation(); });
document.querySelector('.center').addEventListener('click', function(e){
  if (e.target && e.target.id === 'stage') select(null);
});
// srcdoc replacement destroys every binding inside the preview, so the whole
// direct-manipulation layer is re-created on each load.
$('frame').addEventListener('load', onFrameLoad);

boot();
`;

export function editorPage(name: string): string {
  const safeName = String(name)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const nameJson = JSON.stringify(String(name));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${safeName} — Renderkit editor</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>${EDITOR_CSS}</style>
</head>
<body>
<div class="top">
  <a class="logo" href="/" style="display:flex;align-items:center;gap:9px"><span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;background:#191e27;border-radius:7px"><img src="/brand-logo.png" alt="" style="height:16px;width:auto"></span><span style="letter-spacing:0.14em;font-weight:600;color:var(--text)">renderkit</span></a>
  <a class="back" href="/app">&larr; Templates</a>
  <span class="tname">${safeName}</span>
  <span class="kindpill">block template</span>
  <span class="spacer"></span>
  <span class="state" id="state">Loading…</span>
  <button id="saveBtn">Save</button>
</div>

<div class="cols">
  <aside class="col left">
    <div class="sec">
      <h3>Layout</h3>
      <div id="presetWrap"></div>
      <div id="mediaWrap"></div>
    </div>
    <div id="tree"></div>
  </aside>

  <main class="col center">
    <div class="stage" id="stage">
      <div class="holder" id="holder"><iframe id="frame" title="preview"></iframe></div>
    </div>
    <div class="belowbar">
      <span class="meta" id="dims"></span>
      <span class="spacer"></span>
      <button class="ghost" onclick="refreshPreview()">Refresh preview</button>
      <button id="renderBtn">Render PNG</button>
    </div>
  </main>

  <aside class="col right" id="props"></aside>
</div>

<div class="toast" id="toast" style="display:none"></div>

<script>window.__TPL_NAME__ = ${nameJson};</script>
<script>${EDITOR_JS}</script>
</body>
</html>`;
}

export default editorPage;
