/* ============================================================
   Ramen Stock Manager — app.js
   Connects to Google Apps Script Web App as backend
   ============================================================ */

// ===== CONFIG =====
let CONFIG = {
  scriptUrl: localStorage.getItem('scriptUrl') || '',
  shopName: localStorage.getItem('shopName') || 'Ramen Shop',
  currency: localStorage.getItem('currency') || '฿',
};

// ===== STATE =====
let STATE = {
  inventory: [],
  recipes: [],
  usage: [],
  orders: [],
  loading: false,
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  setDate();
  setupNav();
  loadSettings();

  if (CONFIG.scriptUrl) {
    syncData();
  } else {
    renderMockData();
    showAlert('⚠ No Apps Script URL set. Showing demo data. Go to Settings to connect your Google Sheet.', 'warn');
  }
});

function setDate() {
  const d = new Date();
  document.getElementById('page-date').textContent =
    d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const usageDateInput = document.getElementById('usage-date');
  if (usageDateInput) usageDateInput.value = d.toISOString().split('T')[0];
}

// ===== NAVIGATION =====
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.page;
      navigateTo(page);
    });
  });
}

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  document.getElementById(`page-${page}`).classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    inventory: 'Inventory',
    recipes: 'Recipe Costs',
    usage: 'Usage Logs',
    orders: 'Purchase Orders',
  };
  document.getElementById('page-title').textContent = titles[page] || page;
}

// ===== API CALLS =====
async function apiFetch(action, payload = {}) {
  if (!CONFIG.scriptUrl) throw new Error('No Apps Script URL configured');
  const url = new URL(CONFIG.scriptUrl);
  url.searchParams.set('action', action);
  Object.entries(payload).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(action, data) {
  if (!CONFIG.scriptUrl) throw new Error('No Apps Script URL configured');
  const res = await fetch(CONFIG.scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
    mode: 'no-cors',
  });
  return { ok: true };
}

// ===== SYNC =====
async function syncData() {
  if (!CONFIG.scriptUrl) {
    showAlert('Set your Apps Script URL in Settings first.', 'warn');
    return;
  }

  const btn = document.getElementById('sync-btn');
  btn.classList.add('syncing');
  btn.innerHTML = '<span class="spinner"></span> Syncing…';

  try {
    const [inv, rec, usage, orders] = await Promise.all([
      apiFetch('getInventory'),
      apiFetch('getRecipes'),
      apiFetch('getUsage'),
      apiFetch('getOrders'),
    ]);

    STATE.inventory = inv.data || [];
    STATE.recipes = rec.data || [];
    STATE.usage = usage.data || [];
    STATE.orders = orders.data || [];

    renderAll();
    hideAlert();
  } catch (err) {
    showAlert('⚠ Could not sync with Google Sheets. Check your Apps Script URL and deployment. ' + err.message, 'warn');
    renderMockData();
  } finally {
    btn.classList.remove('syncing');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Sync Sheets`;
  }
}

// ===== RENDER ALL =====
function renderAll() {
  renderDashboard();
  renderInventory();
  renderRecipes();
  renderUsage();
  renderOrders();
}

// ===== DASHBOARD =====
function renderDashboard() {
  const lowStock = STATE.inventory.filter(i => parseFloat(i.quantity) <= parseFloat(i.minLevel));
  const pending = STATE.orders.filter(o => o.status === 'Pending');

  document.getElementById('stat-total').textContent = STATE.inventory.length;
  document.getElementById('stat-low').textContent = lowStock.length;
  document.getElementById('stat-orders').textContent = pending.length;

  const costs = STATE.recipes.map(r => parseFloat(r.totalCost) || 0).filter(c => c > 0);
  const avgCost = costs.length ? (costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(0) : '—';
  document.getElementById('stat-cost').textContent = costs.length ? CONFIG.currency + avgCost : '—';

  document.getElementById('low-stock-count').textContent = lowStock.length;

  const lowList = document.getElementById('low-stock-list');
  if (lowStock.length === 0) {
    lowList.innerHTML = '<div class="empty-state">✅ All stock levels are fine!</div>';
  } else {
    lowList.innerHTML = lowStock.map(i => `
      <div class="alert-item">
        <div>
          <div class="alert-item-name">${escHtml(i.name)}</div>
          <div class="alert-item-detail">${escHtml(i.category)} · ${i.quantity} ${i.unit} remaining</div>
        </div>
        <span class="badge ${parseFloat(i.quantity) === 0 ? 'badge-danger' : 'badge-warn'}">
          ${parseFloat(i.quantity) === 0 ? 'OUT' : 'LOW'}
        </span>
      </div>`).join('');
  }

  const recentList = document.getElementById('recent-usage');
  const recent = [...STATE.usage].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  if (recent.length === 0) {
    recentList.innerHTML = '<div class="empty-state">No usage logs yet.</div>';
  } else {
    recentList.innerHTML = recent.map(u => `
      <div class="alert-item">
        <div>
          <div class="alert-item-name">${escHtml(u.recipe)}</div>
          <div class="alert-item-detail">${u.date} · ${u.servings} servings</div>
        </div>
        <span style="font-weight:600;color:var(--accent2)">${CONFIG.currency}${(parseFloat(u.cost)||0).toFixed(0)}</span>
      </div>`).join('');
  }
}

// ===== INVENTORY =====
function renderInventory(filter = '', category = '') {
  const body = document.getElementById('inventory-body');
  let items = STATE.inventory;

  if (filter) items = items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()));
  if (category) items = items.filter(i => i.category === category);

  if (items.length === 0) {
    body.innerHTML = `<tr><td colspan="8" class="empty-state">No ingredients found.</td></tr>`;
    return;
  }

  body.innerHTML = items.map((i, idx) => {
    const qty = parseFloat(i.quantity);
    const min = parseFloat(i.minLevel);
    let statusClass = 'status-ok', statusLabel = 'OK';
    if (qty === 0) { statusClass = 'status-out'; statusLabel = 'OUT'; }
    else if (qty <= min) { statusClass = 'status-low'; statusLabel = 'LOW'; }

    return `<tr>
      <td><strong>${escHtml(i.name)}</strong></td>
      <td>${escHtml(i.category)}</td>
      <td>${i.quantity}</td>
      <td>${i.minLevel}</td>
      <td>${escHtml(i.unit)}</td>
      <td>${CONFIG.currency}${parseFloat(i.unitCost || 0).toFixed(2)}</td>
      <td><span class="${statusClass}">${statusLabel}</span></td>
      <td>
        <button class="btn-primary btn-sm" onclick="openEditIngredient(${idx})">Edit</button>
        <button class="btn-ghost btn-sm" onclick="openAdjustStock(${idx})">Adjust</button>
      </td>
    </tr>`;
  }).join('');
}

function filterInventory(val) {
  const search = document.getElementById('inv-search').value;
  const cat = document.getElementById('inv-category').value;
  renderInventory(search, cat);
}

// ===== RECIPES =====
function renderRecipes() {
  const grid = document.getElementById('recipes-grid');
  if (STATE.recipes.length === 0) {
    grid.innerHTML = '<div class="empty-state">No recipes yet. Add your first recipe!</div>';
    return;
  }

  grid.innerHTML = STATE.recipes.map((r, idx) => {
    const cost = parseFloat(r.totalCost) || 0;
    const ings = Array.isArray(r.ingredients) ? r.ingredients : [];
    return `
      <div class="recipe-card" onclick="openRecipeDetail(${idx})">
        <div class="recipe-name">${escHtml(r.name)}</div>
        <div style="font-size:12px;color:var(--text3)">${r.servings || 1} serving(s)</div>
        <div class="recipe-cost">${CONFIG.currency}${cost.toFixed(2)}</div>
        <div class="recipe-cost-label">cost per serving</div>
        <div class="recipe-ingredients">
          ${ings.slice(0, 4).map(ing => `
            <div class="recipe-ing-item">
              <span>${escHtml(ing.name)}</span>
              <span>${ing.amount} ${escHtml(ing.unit)}</span>
            </div>`).join('')}
          ${ings.length > 4 ? `<div style="font-size:11px;color:var(--text3);padding:4px 0">+${ings.length - 4} more ingredients</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ===== USAGE =====
function renderUsage() {
  const body = document.getElementById('usage-body');
  const select = document.getElementById('usage-recipe');
  const recipes = [...new Set(STATE.usage.map(u => u.recipe))];
  select.innerHTML = '<option value="">All Recipes</option>' +
    recipes.map(r => `<option>${escHtml(r)}</option>`).join('');

  if (STATE.usage.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">No usage logs yet.</td></tr>';
    return;
  }

  const sorted = [...STATE.usage].sort((a, b) => new Date(b.date) - new Date(a.date));
  body.innerHTML = sorted.map(u => `
    <tr>
      <td>${u.date}</td>
      <td>${escHtml(u.recipe)}</td>
      <td>${u.servings}</td>
      <td style="font-size:12px;color:var(--text3)">${Array.isArray(u.ingredients) ? u.ingredients.join(', ') : (u.ingredients || '—')}</td>
      <td style="color:var(--accent2);font-weight:600">${CONFIG.currency}${(parseFloat(u.cost)||0).toFixed(2)}</td>
    </tr>`).join('');
}

// ===== ORDERS =====
function renderOrders(statusFilter = '') {
  const list = document.getElementById('orders-list');
  let orders = STATE.orders;
  if (statusFilter) orders = orders.filter(o => o.status === statusFilter);

  if (orders.length === 0) {
    list.innerHTML = '<div class="empty-state">No purchase orders.</div>';
    return;
  }

  list.innerHTML = orders.map((o, idx) => {
    const statusClass = { Pending: 'status-pending', Ordered: 'status-ordered', Received: 'status-received' }[o.status] || '';
    const items = Array.isArray(o.items) ? o.items : [];
    return `
      <div class="order-card">
        <div class="order-card-head">
          <span class="order-id">Order #${o.id || (idx + 1)}</span>
          <span class="${statusClass}">${o.status}</span>
        </div>
        <div class="order-items">
          ${items.map(item => `<span>${escHtml(item.name)} × ${item.quantity} ${item.unit}</span>`).join(' &nbsp;·&nbsp; ') || escHtml(o.notes || '—')}
        </div>
        <div class="order-meta">
          <span>📅 ${o.date || '—'}</span>
          <span>💰 ${CONFIG.currency}${(parseFloat(o.total)||0).toFixed(2)}</span>
          <span>👤 ${escHtml(o.supplier || '—')}</span>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px">
          ${o.status === 'Pending' ? `<button class="btn-primary btn-sm" onclick="updateOrderStatus(${idx},'Ordered')">Mark Ordered</button>` : ''}
          ${o.status === 'Ordered' ? `<button class="btn-primary btn-sm" onclick="updateOrderStatus(${idx},'Received')">Mark Received</button>` : ''}
          <button class="btn-ghost btn-sm" onclick="deleteOrder(${idx})">Delete</button>
        </div>
      </div>`;
  }).join('');
}

function filterOrders() {
  renderOrders(document.getElementById('order-status').value);
}

// ===== MODALS =====
function openAddIngredient() {
  document.getElementById('modal-title').textContent = 'Add Ingredient';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Ingredient Name</label>
      <input type="text" id="f-name" class="form-input" placeholder="e.g. Tonkotsu Broth" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Category</label>
        <select id="f-cat" class="form-select">
          <option>Broth</option><option>Noodles</option><option>Toppings</option>
          <option>Protein</option><option>Seasoning</option><option>Vegetables</option><option>Other</option>
        </select>
      </div>
      <div class="form-group">
        <label>Unit</label>
        <input type="text" id="f-unit" class="form-input" placeholder="kg / L / pcs" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Current Stock</label>
        <input type="number" id="f-qty" class="form-input" placeholder="0" step="0.01" />
      </div>
      <div class="form-group">
        <label>Min. Level (alert threshold)</label>
        <input type="number" id="f-min" class="form-input" placeholder="5" step="0.01" />
      </div>
    </div>
    <div class="form-group">
      <label>Unit Cost (${CONFIG.currency})</label>
      <input type="number" id="f-cost" class="form-input" placeholder="0.00" step="0.01" />
    </div>`;
  document.getElementById('modal-save-btn').onclick = saveIngredient;
  showModal();
}

async function saveIngredient() {
  const item = {
    name: document.getElementById('f-name').value,
    category: document.getElementById('f-cat').value,
    unit: document.getElementById('f-unit').value,
    quantity: document.getElementById('f-qty').value,
    minLevel: document.getElementById('f-min').value,
    unitCost: document.getElementById('f-cost').value,
  };
  if (!item.name) { alert('Please enter a name.'); return; }

  STATE.inventory.push(item);
  try {
    await apiPost('addIngredient', item);
  } catch (_) {}
  closeModal();
  renderInventory();
  renderDashboard();
}

function openEditIngredient(idx) {
  const i = STATE.inventory[idx];
  document.getElementById('modal-title').textContent = 'Edit Ingredient';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Ingredient Name</label>
      <input type="text" id="f-name" class="form-input" value="${escHtml(i.name)}" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Category</label>
        <select id="f-cat" class="form-select">
          ${['Broth','Noodles','Toppings','Protein','Seasoning','Vegetables','Other'].map(c => `<option ${c===i.category?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Unit</label>
        <input type="text" id="f-unit" class="form-input" value="${escHtml(i.unit)}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Current Stock</label>
        <input type="number" id="f-qty" class="form-input" value="${i.quantity}" step="0.01" />
      </div>
      <div class="form-group">
        <label>Min. Level</label>
        <input type="number" id="f-min" class="form-input" value="${i.minLevel}" step="0.01" />
      </div>
    </div>
    <div class="form-group">
      <label>Unit Cost</label>
      <input type="number" id="f-cost" class="form-input" value="${i.unitCost}" step="0.01" />
    </div>`;
  document.getElementById('modal-save-btn').onclick = async () => {
    STATE.inventory[idx] = {
      ...i,
      name: document.getElementById('f-name').value,
      category: document.getElementById('f-cat').value,
      unit: document.getElementById('f-unit').value,
      quantity: document.getElementById('f-qty').value,
      minLevel: document.getElementById('f-min').value,
      unitCost: document.getElementById('f-cost').value,
    };
    try { await apiPost('updateIngredient', { idx, ...STATE.inventory[idx] }); } catch (_) {}
    closeModal(); renderInventory(); renderDashboard();
  };
  showModal();
}

function openAdjustStock(idx) {
  const i = STATE.inventory[idx];
  document.getElementById('modal-title').textContent = `Adjust Stock: ${i.name}`;
  document.getElementById('modal-body').innerHTML = `
    <p style="color:var(--text2);margin-bottom:16px">Current stock: <strong>${i.quantity} ${i.unit}</strong></p>
    <div class="form-group">
      <label>Adjustment Type</label>
      <select id="f-adj-type" class="form-select">
        <option value="add">Add Stock (delivery received)</option>
        <option value="remove">Remove Stock (spoilage/waste)</option>
        <option value="set">Set Exact Amount</option>
      </select>
    </div>
    <div class="form-group">
      <label>Amount (${i.unit})</label>
      <input type="number" id="f-adj-amt" class="form-input" placeholder="0" step="0.01" min="0" />
    </div>
    <div class="form-group">
      <label>Notes</label>
      <input type="text" id="f-adj-note" class="form-input" placeholder="Optional note" />
    </div>`;
  document.getElementById('modal-save-btn').onclick = async () => {
    const type = document.getElementById('f-adj-type').value;
    const amt = parseFloat(document.getElementById('f-adj-amt').value) || 0;
    let newQty = parseFloat(i.quantity);
    if (type === 'add') newQty += amt;
    else if (type === 'remove') newQty = Math.max(0, newQty - amt);
    else newQty = amt;
    STATE.inventory[idx].quantity = newQty.toFixed(2);
    try { await apiPost('adjustStock', { idx, quantity: newQty, notes: document.getElementById('f-adj-note').value }); } catch (_) {}
    closeModal(); renderInventory(); renderDashboard();
  };
  showModal();
}

function openAddRecipe() {
  document.getElementById('modal-title').textContent = 'Add Recipe';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Recipe Name</label>
      <input type="text" id="f-rname" class="form-input" placeholder="e.g. Tonkotsu Ramen" />
    </div>
    <div class="form-group">
      <label>Servings per batch</label>
      <input type="number" id="f-rservings" class="form-input" value="1" min="1" />
    </div>
    <div class="form-group">
      <label>Ingredients (one per line: Name, Amount, Unit)</label>
      <textarea id="f-rings" class="form-input" rows="5" placeholder="Tonkotsu Broth, 0.5, L&#10;Ramen Noodles, 120, g&#10;Chashu Pork, 80, g"></textarea>
      <small>Format: Ingredient Name, Amount, Unit</small>
    </div>`;
  document.getElementById('modal-save-btn').onclick = async () => {
    const lines = document.getElementById('f-rings').value.split('\n').filter(l => l.trim());
    const ingredients = lines.map(l => {
      const [name, amount, unit] = l.split(',').map(s => s.trim());
      const invItem = STATE.inventory.find(i => i.name.toLowerCase() === (name||'').toLowerCase());
      const cost = invItem ? parseFloat(invItem.unitCost) * parseFloat(amount || 0) : 0;
      return { name: name || '', amount: amount || '0', unit: unit || '', cost };
    });
    const totalCost = (ingredients.reduce((s, i) => s + (i.cost || 0), 0) / (parseInt(document.getElementById('f-rservings').value) || 1)).toFixed(2);
    const recipe = {
      name: document.getElementById('f-rname').value,
      servings: document.getElementById('f-rservings').value,
      ingredients,
      totalCost,
    };
    STATE.recipes.push(recipe);
    try { await apiPost('addRecipe', recipe); } catch (_) {}
    closeModal(); renderRecipes();
  };
  showModal();
}

function openRecipeDetail(idx) {
  const r = STATE.recipes[idx];
  const ings = Array.isArray(r.ingredients) ? r.ingredients : [];
  document.getElementById('modal-title').textContent = r.name;
  document.getElementById('modal-body').innerHTML = `
    <div style="margin-bottom:20px">
      <div style="font-size:28px;font-weight:700;color:var(--accent2);font-family:var(--font-head)">${CONFIG.currency}${parseFloat(r.totalCost).toFixed(2)}</div>
      <div style="font-size:12px;color:var(--text3)">cost per serving · ${r.servings} serving(s) per batch</div>
    </div>
    <table class="data-table">
      <thead><tr><th>Ingredient</th><th>Amount</th><th>Unit</th><th>Cost</th></tr></thead>
      <tbody>
        ${ings.map(i => `<tr>
          <td>${escHtml(i.name)}</td>
          <td>${i.amount}</td>
          <td>${escHtml(i.unit)}</td>
          <td>${CONFIG.currency}${parseFloat(i.cost||0).toFixed(2)}</td>
        </tr>`).join('')}
        <tr style="font-weight:600;border-top:2px solid var(--border)">
          <td colspan="3" style="text-align:right">Total per batch:</td>
          <td style="color:var(--accent2)">${CONFIG.currency}${(parseFloat(r.totalCost) * parseInt(r.servings)).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>`;
  document.getElementById('modal-save-btn').style.display = 'none';
  document.querySelector('.modal-footer .btn-ghost').textContent = 'Close';
  showModal();
}

function openLogUsage() {
  document.getElementById('modal-title').textContent = 'Log Usage';
  const recipeOptions = STATE.recipes.map(r => `<option>${escHtml(r.name)}</option>`).join('');
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Date</label>
      <input type="date" id="f-udate" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
    </div>
    <div class="form-group">
      <label>Recipe</label>
      <select id="f-urecipe" class="form-select" onchange="previewUsageCost()">
        <option value="">-- Select Recipe --</option>
        ${recipeOptions}
      </select>
    </div>
    <div class="form-group">
      <label>Number of Servings Sold</label>
      <input type="number" id="f-uservings" class="form-input" value="1" min="1" oninput="previewUsageCost()" />
    </div>
    <div id="usage-cost-preview" style="background:var(--bg3);border-radius:8px;padding:12px 16px;margin-top:8px;font-size:13px;color:var(--text2)">Select a recipe to see cost estimate.</div>`;
  document.getElementById('modal-save-btn').onclick = async () => {
    const recipe = STATE.recipes.find(r => r.name === document.getElementById('f-urecipe').value);
    const servings = parseInt(document.getElementById('f-uservings').value) || 1;
    const cost = recipe ? (parseFloat(recipe.totalCost) * servings).toFixed(2) : '0';
    const log = {
      date: document.getElementById('f-udate').value,
      recipe: document.getElementById('f-urecipe').value,
      servings,
      cost,
      ingredients: recipe ? recipe.ingredients.map(i => i.name) : [],
    };
    STATE.usage.push(log);

    // Deduct from inventory
    if (recipe && Array.isArray(recipe.ingredients)) {
      recipe.ingredients.forEach(ing => {
        const invItem = STATE.inventory.find(i => i.name.toLowerCase() === ing.name.toLowerCase());
        if (invItem) {
          invItem.quantity = Math.max(0, parseFloat(invItem.quantity) - (parseFloat(ing.amount) * servings)).toFixed(2);
        }
      });
    }

    try { await apiPost('addUsage', log); } catch (_) {}
    closeModal(); renderAll();
  };
  showModal();
}

function previewUsageCost() {
  const recipe = STATE.recipes.find(r => r.name === document.getElementById('f-urecipe')?.value);
  const servings = parseInt(document.getElementById('f-uservings')?.value) || 1;
  const preview = document.getElementById('usage-cost-preview');
  if (preview) {
    if (recipe) {
      const total = (parseFloat(recipe.totalCost) * servings).toFixed(2);
      preview.innerHTML = `<strong>Estimated ingredient cost:</strong> ${CONFIG.currency}${total} for ${servings} serving(s)`;
    } else {
      preview.textContent = 'Select a recipe to see cost estimate.';
    }
  }
}

function openCreateOrder() {
  const lowItems = STATE.inventory.filter(i => parseFloat(i.quantity) <= parseFloat(i.minLevel));
  document.getElementById('modal-title').textContent = 'Create Purchase Order';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Supplier / Vendor</label>
      <input type="text" id="f-osupplier" class="form-input" placeholder="Supplier name" />
    </div>
    <div class="form-group">
      <label>Order Date</label>
      <input type="date" id="f-odate" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
    </div>
    ${lowItems.length > 0 ? `
    <div class="form-group">
      <label>Suggested (Low Stock Items)</label>
      <div style="background:var(--bg3);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text2)">
        ${lowItems.map(i => `${escHtml(i.name)} (${i.quantity} ${i.unit} left)`).join('<br>')}
      </div>
    </div>` : ''}
    <div class="form-group">
      <label>Items (one per line: Name, Quantity, Unit)</label>
      <textarea id="f-oitems" class="form-input" rows="5" placeholder="Pork Bones, 10, kg&#10;Soy Sauce, 5, L">${lowItems.map(i => `${i.name}, , ${i.unit}`).join('\n')}</textarea>
    </div>
    <div class="form-group">
      <label>Estimated Total (${CONFIG.currency})</label>
      <input type="number" id="f-ototal" class="form-input" placeholder="0.00" step="0.01" />
    </div>`;
  document.getElementById('modal-save-btn').onclick = async () => {
    const lines = document.getElementById('f-oitems').value.split('\n').filter(l => l.trim());
    const items = lines.map(l => {
      const [name, quantity, unit] = l.split(',').map(s => s.trim());
      return { name, quantity, unit };
    });
    const order = {
      id: Date.now(),
      date: document.getElementById('f-odate').value,
      supplier: document.getElementById('f-osupplier').value,
      items,
      total: document.getElementById('f-ototal').value,
      status: 'Pending',
    };
    STATE.orders.push(order);
    try { await apiPost('addOrder', order); } catch (_) {}
    closeModal(); renderOrders(); renderDashboard();
  };
  showModal();
}

async function updateOrderStatus(idx, status) {
  STATE.orders[idx].status = status;
  try { await apiPost('updateOrderStatus', { idx, status }); } catch (_) {}
  renderOrders(document.getElementById('order-status').value);
  renderDashboard();
}

async function deleteOrder(idx) {
  if (!confirm('Delete this order?')) return;
  STATE.orders.splice(idx, 1);
  try { await apiPost('deleteOrder', { idx }); } catch (_) {}
  renderOrders();
  renderDashboard();
}

function showModal() {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-save-btn').style.display = '';
  document.querySelector('.modal-footer .btn-ghost').textContent = 'Cancel';
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ===== SETTINGS =====
function loadSettings() {
  document.getElementById('script-url').value = CONFIG.scriptUrl;
  document.getElementById('shop-name').value = CONFIG.shopName;
  document.getElementById('currency').value = CONFIG.currency;
  document.querySelector('.brand-name').textContent = CONFIG.shopName;
}

function saveSettings() {
  CONFIG.scriptUrl = document.getElementById('script-url').value.trim();
  CONFIG.shopName = document.getElementById('shop-name').value.trim() || 'Ramen Shop';
  CONFIG.currency = document.getElementById('currency').value.trim() || '฿';
  localStorage.setItem('scriptUrl', CONFIG.scriptUrl);
  localStorage.setItem('shopName', CONFIG.shopName);
  localStorage.setItem('currency', CONFIG.currency);
  document.querySelector('.brand-name').textContent = CONFIG.shopName;
  closeSettings();
  if (CONFIG.scriptUrl) syncData();
}

function openSettings() {
  loadSettings();
  document.getElementById('settings-overlay').classList.remove('hidden');
}

function closeSettings(e) {
  if (e && e.target !== document.getElementById('settings-overlay')) return;
  document.getElementById('settings-overlay').classList.add('hidden');
}

// ===== ALERTS =====
function showAlert(msg, type = 'warn') {
  const bar = document.getElementById('alert-bar');
  bar.textContent = msg;
  bar.classList.remove('hidden');
}

function hideAlert() {
  document.getElementById('alert-bar').classList.add('hidden');
}

// ===== UTILITIES =====
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== MOCK DATA (for demo when no Script URL) =====
function renderMockData() {
  STATE.inventory = [
    { name: 'Pork Bones', category: 'Broth', quantity: '2', minLevel: '5', unit: 'kg', unitCost: '80' },
    { name: 'Ramen Noodles', category: 'Noodles', quantity: '15', minLevel: '10', unit: 'kg', unitCost: '60' },
    { name: 'Chashu Pork', category: 'Protein', quantity: '3', minLevel: '4', unit: 'kg', unitCost: '250' },
    { name: 'Soft-Boiled Eggs', category: 'Toppings', quantity: '24', minLevel: '20', unit: 'pcs', unitCost: '8' },
    { name: 'Nori Sheets', category: 'Toppings', quantity: '0', minLevel: '50', unit: 'pcs', unitCost: '2' },
    { name: 'Soy Sauce', category: 'Seasoning', quantity: '8', minLevel: '5', unit: 'L', unitCost: '40' },
    { name: 'Miso Paste', category: 'Seasoning', quantity: '2', minLevel: '3', unit: 'kg', unitCost: '120' },
    { name: 'Green Onion', category: 'Vegetables', quantity: '10', minLevel: '5', unit: 'bunches', unitCost: '15' },
    { name: 'Bamboo Shoots', category: 'Toppings', quantity: '6', minLevel: '4', unit: 'cans', unitCost: '35' },
    { name: 'Chicken Broth', category: 'Broth', quantity: '20', minLevel: '10', unit: 'L', unitCost: '30' },
  ];

  STATE.recipes = [
    {
      name: 'Tonkotsu Ramen',
      servings: 1,
      totalCost: '185.00',
      ingredients: [
        { name: 'Pork Bones', amount: '0.3', unit: 'kg', cost: 24 },
        { name: 'Ramen Noodles', amount: '0.12', unit: 'kg', cost: 7.2 },
        { name: 'Chashu Pork', amount: '0.08', unit: 'kg', cost: 20 },
        { name: 'Soft-Boiled Eggs', amount: '1', unit: 'pcs', cost: 8 },
        { name: 'Nori Sheets', amount: '2', unit: 'pcs', cost: 4 },
        { name: 'Green Onion', amount: '0.1', unit: 'bunches', cost: 1.5 },
      ],
    },
    {
      name: 'Shoyu Ramen',
      servings: 1,
      totalCost: '120.00',
      ingredients: [
        { name: 'Chicken Broth', amount: '0.5', unit: 'L', cost: 15 },
        { name: 'Soy Sauce', amount: '0.03', unit: 'L', cost: 1.2 },
        { name: 'Ramen Noodles', amount: '0.12', unit: 'kg', cost: 7.2 },
        { name: 'Bamboo Shoots', amount: '0.1', unit: 'cans', cost: 3.5 },
      ],
    },
    {
      name: 'Miso Ramen',
      servings: 1,
      totalCost: '145.00',
      ingredients: [
        { name: 'Miso Paste', amount: '0.04', unit: 'kg', cost: 4.8 },
        { name: 'Chicken Broth', amount: '0.4', unit: 'L', cost: 12 },
        { name: 'Ramen Noodles', amount: '0.12', unit: 'kg', cost: 7.2 },
        { name: 'Chashu Pork', amount: '0.06', unit: 'kg', cost: 15 },
      ],
    },
  ];

  STATE.usage = [
    { date: new Date(Date.now()-86400000).toISOString().split('T')[0], recipe: 'Tonkotsu Ramen', servings: 32, cost: '5920', ingredients: ['Pork Bones','Ramen Noodles','Chashu Pork'] },
    { date: new Date(Date.now()-86400000).toISOString().split('T')[0], recipe: 'Shoyu Ramen', servings: 18, cost: '2160', ingredients: ['Chicken Broth','Soy Sauce','Ramen Noodles'] },
    { date: new Date(Date.now()-172800000).toISOString().split('T')[0], recipe: 'Miso Ramen', servings: 24, cost: '3480', ingredients: ['Miso Paste','Chicken Broth'] },
    { date: new Date(Date.now()-172800000).toISOString().split('T')[0], recipe: 'Tonkotsu Ramen', servings: 40, cost: '7400', ingredients: ['Pork Bones','Chashu Pork'] },
  ];

  STATE.orders = [
    { id: 1001, date: new Date().toISOString().split('T')[0], supplier: 'Fresh Market BKK', items: [{name:'Pork Bones',quantity:'20',unit:'kg'},{name:'Nori Sheets',quantity:'200',unit:'pcs'}], total: '2200', status: 'Pending' },
    { id: 1000, date: new Date(Date.now()-432000000).toISOString().split('T')[0], supplier: 'Noodle Warehouse', items: [{name:'Ramen Noodles',quantity:'50',unit:'kg'}], total: '3000', status: 'Received' },
  ];

  renderAll();
}
