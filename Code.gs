/**
 * ============================================================
 *  RAMEN STOCK MANAGER — Google Apps Script Backend
 *  Paste this entire file into your Google Apps Script editor
 *  (script.google.com), then deploy as a Web App.
 * ============================================================
 *
 *  SETUP INSTRUCTIONS:
 *  1. Go to https://sheets.google.com and create a new spreadsheet
 *  2. Name it "Ramen Stock DB"
 *  3. Go to https://script.google.com and create a new project
 *  4. Paste this entire code into Code.gs
 *  5. Replace SPREADSHEET_ID below with your Sheet's ID
 *     (found in the URL: docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit)
 *  6. Click Deploy → New Deployment → Web App
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  7. Copy the Web App URL and paste it into the app's Settings
 * ============================================================
 */

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

// Sheet names
const SHEETS = {
  INVENTORY: 'Inventory',
  RECIPES:   'Recipes',
  USAGE:     'UsageLogs',
  ORDERS:    'PurchaseOrders',
};

// ===== CORS Headers =====
function setCorsHeaders(output) {
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return output;
}

// ===== MAIN ROUTER =====
function doGet(e) {
  const action = e.parameter.action;
  let result;

  try {
    switch (action) {
      case 'getInventory': result = getInventory(); break;
      case 'getRecipes':   result = getRecipes();   break;
      case 'getUsage':     result = getUsage();     break;
      case 'getOrders':    result = getOrders();    break;
      default:
        result = { ok: true, message: 'Ramen Stock API is running!' };
    }
  } catch (err) {
    result = { ok: false, error: err.message };
  }

  return setCorsHeaders(
    ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
  );
}

function doPost(e) {
  let result;
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    switch (action) {
      case 'addIngredient':    result = addIngredient(body);    break;
      case 'updateIngredient': result = updateIngredient(body); break;
      case 'adjustStock':      result = adjustStock(body);      break;
      case 'addRecipe':        result = addRecipe(body);        break;
      case 'addUsage':         result = addUsage(body);         break;
      case 'addOrder':         result = addOrder(body);         break;
      case 'updateOrderStatus': result = updateOrderStatus(body); break;
      case 'deleteOrder':      result = deleteOrder(body);      break;
      default:
        result = { ok: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { ok: false, error: err.message };
  }

  return setCorsHeaders(
    ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
  );
}

// ===== SPREADSHEET HELPER =====
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Add headers
    const headers = {
      [SHEETS.INVENTORY]: ['name','category','quantity','minLevel','unit','unitCost'],
      [SHEETS.RECIPES]:   ['name','servings','ingredients','totalCost'],
      [SHEETS.USAGE]:     ['date','recipe','servings','cost','ingredients'],
      [SHEETS.ORDERS]:    ['id','date','supplier','items','total','status'],
    };
    if (headers[name]) sheet.appendRow(headers[name]);
  }
  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      // Try to parse JSON fields (ingredients, items)
      if ((h === 'ingredients' || h === 'items') && typeof val === 'string' && val.startsWith('[')) {
        try { val = JSON.parse(val); } catch (_) {}
      }
      obj[h] = val;
    });
    return obj;
  });
}

// ===== GET FUNCTIONS =====
function getInventory() {
  return { ok: true, data: sheetToObjects(getSheet(SHEETS.INVENTORY)) };
}

function getRecipes() {
  return { ok: true, data: sheetToObjects(getSheet(SHEETS.RECIPES)) };
}

function getUsage() {
  return { ok: true, data: sheetToObjects(getSheet(SHEETS.USAGE)) };
}

function getOrders() {
  return { ok: true, data: sheetToObjects(getSheet(SHEETS.ORDERS)) };
}

// ===== INVENTORY FUNCTIONS =====
function addIngredient(data) {
  const sheet = getSheet(SHEETS.INVENTORY);
  sheet.appendRow([
    data.name, data.category, data.quantity,
    data.minLevel, data.unit, data.unitCost
  ]);
  return { ok: true };
}

function updateIngredient(data) {
  const sheet = getSheet(SHEETS.INVENTORY);
  const rows = sheet.getDataRange().getValues();
  // Find row by name (row 0 = header, data starts at row 1)
  for (let i = 1; i < rows.length; i++) {
    // Match by original name or by index
    if (i - 1 === parseInt(data.idx) || rows[i][0] === data.originalName) {
      sheet.getRange(i + 1, 1, 1, 6).setValues([[
        data.name, data.category, data.quantity,
        data.minLevel, data.unit, data.unitCost
      ]]);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Ingredient not found' };
}

function adjustStock(data) {
  const sheet = getSheet(SHEETS.INVENTORY);
  const rowNum = parseInt(data.idx) + 2; // +1 for header, +1 for 1-based index
  if (rowNum > 1) {
    sheet.getRange(rowNum, 3).setValue(data.quantity); // column 3 = quantity
    return { ok: true };
  }
  return { ok: false, error: 'Invalid index' };
}

// ===== RECIPE FUNCTIONS =====
function addRecipe(data) {
  const sheet = getSheet(SHEETS.RECIPES);
  sheet.appendRow([
    data.name,
    data.servings,
    JSON.stringify(data.ingredients || []),
    data.totalCost
  ]);
  return { ok: true };
}

// ===== USAGE FUNCTIONS =====
function addUsage(data) {
  const sheet = getSheet(SHEETS.USAGE);
  sheet.appendRow([
    data.date,
    data.recipe,
    data.servings,
    data.cost,
    JSON.stringify(data.ingredients || [])
  ]);
  return { ok: true };
}

// ===== ORDER FUNCTIONS =====
function addOrder(data) {
  const sheet = getSheet(SHEETS.ORDERS);
  sheet.appendRow([
    data.id,
    data.date,
    data.supplier,
    JSON.stringify(data.items || []),
    data.total,
    data.status || 'Pending'
  ]);
  return { ok: true };
}

function updateOrderStatus(data) {
  const sheet = getSheet(SHEETS.ORDERS);
  const rowNum = parseInt(data.idx) + 2;
  if (rowNum > 1) {
    sheet.getRange(rowNum, 6).setValue(data.status); // column 6 = status
    return { ok: true };
  }
  return { ok: false, error: 'Invalid index' };
}

function deleteOrder(data) {
  const sheet = getSheet(SHEETS.ORDERS);
  const rowNum = parseInt(data.idx) + 2;
  if (rowNum > 1) {
    sheet.deleteRow(rowNum);
    return { ok: true };
  }
  return { ok: false, error: 'Invalid index' };
}

// ===== INITIAL SETUP =====
/**
 * Run this function once from the Apps Script editor
 * to create all sheets with sample data.
 */
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Delete existing sheets (keep one to avoid error)
  const existing = ss.getSheets();
  existing.slice(1).forEach(s => ss.deleteSheet(s));

  // Create & populate Inventory
  const invSheet = ss.getSheets()[0];
  invSheet.setName(SHEETS.INVENTORY);
  invSheet.clearContents();
  invSheet.appendRow(['name','category','quantity','minLevel','unit','unitCost']);
  const sampleInventory = [
    ['Pork Bones','Broth','2','5','kg','80'],
    ['Ramen Noodles','Noodles','15','10','kg','60'],
    ['Chashu Pork','Protein','3','4','kg','250'],
    ['Soft-Boiled Eggs','Toppings','24','20','pcs','8'],
    ['Nori Sheets','Toppings','0','50','pcs','2'],
    ['Soy Sauce','Seasoning','8','5','L','40'],
    ['Miso Paste','Seasoning','2','3','kg','120'],
    ['Green Onion','Vegetables','10','5','bunches','15'],
    ['Bamboo Shoots','Toppings','6','4','cans','35'],
    ['Chicken Broth','Broth','20','10','L','30'],
  ];
  sampleInventory.forEach(r => invSheet.appendRow(r));

  // Create Recipes sheet
  const recSheet = ss.insertSheet(SHEETS.RECIPES);
  recSheet.appendRow(['name','servings','ingredients','totalCost']);
  recSheet.appendRow([
    'Tonkotsu Ramen', 1,
    JSON.stringify([
      {name:'Pork Bones',amount:'0.3',unit:'kg',cost:24},
      {name:'Ramen Noodles',amount:'0.12',unit:'kg',cost:7.2},
      {name:'Chashu Pork',amount:'0.08',unit:'kg',cost:20},
    ]),
    '185.00'
  ]);

  // Create Usage sheet
  const usageSheet = ss.insertSheet(SHEETS.USAGE);
  usageSheet.appendRow(['date','recipe','servings','cost','ingredients']);

  // Create Orders sheet
  const ordersSheet = ss.insertSheet(SHEETS.ORDERS);
  ordersSheet.appendRow(['id','date','supplier','items','total','status']);

  SpreadsheetApp.flush();
  Logger.log('✅ All sheets created! Spreadsheet ID: ' + SPREADSHEET_ID);
}
