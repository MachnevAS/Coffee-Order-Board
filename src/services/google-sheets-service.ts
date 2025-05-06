'use server';
/**
 * @fileoverview Service for interacting with the Google Sheets API using Service Account authentication.
 * Provides functions to fetch, add, update, and delete product data,
 * assuming a sheet structure: Name | Volume | Price | Image URL | Hint
 * Also provides functions for user authentication and data retrieval/update.
 * And functions for sales history management.
 */
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import type { Product } from '@/types/product';
import type { User } from '@/types/user';
import type { Order, SalesHistoryItem, PaymentMethod } from '@/types/order';
import { getRawProductData } from '@/lib/product-defaults';
import { format, parseISO, isValid as isValidDate } from 'date-fns'; // Added isValidDate

// --- Service Account Authentication ---
const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_SHEET_ID: SHEET_ID,
  GOOGLE_SHEET_NAME: PRODUCT_SHEET_NAME_ONLY,
  GOOGLE_USERS_SHEET_NAME: USERS_SHEET_NAME_ONLY,
  GOOGLE_HISTORY_SHEET_NAME: HISTORY_SHEET_NAME_ONLY,
} = process.env;

const PRIVATE_KEY = GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let sheets = null;
let authError = null;

// --- Constants and Helpers ---
// Column mapping for products sheet
const PRODUCT_COLUMN_MAP = { name: 0, volume: 1, price: 2, imageUrl: 3, dataAiHint: 4 };
const PRODUCT_HEADER_ROW_COUNT = 1;
const PRODUCT_DATA_START_ROW = PRODUCT_HEADER_ROW_COUNT + 1;
const PRODUCT_DATA_RANGE = `${PRODUCT_SHEET_NAME_ONLY}!A${PRODUCT_DATA_START_ROW}:E`;
const PRODUCT_FULL_RANGE_FOR_APPEND = `${PRODUCT_SHEET_NAME_ONLY}!A:E`;

// Column mapping for users sheet
const USER_COLUMN_MAP = { id: 0, login: 1, passwordHash: 2, firstName: 3, middleName: 4, lastName: 5, position: 6, iconColor: 7 };
const USER_HEADER_ROW_COUNT = 1;
const USER_DATA_START_ROW = USER_HEADER_ROW_COUNT + 1;
const USER_DATA_RANGE = `${USERS_SHEET_NAME_ONLY}!A${USER_DATA_START_ROW}:H`;

// Column mapping for history sheet
const HISTORY_COLUMN_MAP = { orderId: 0, timestamp: 1, items: 2, paymentMethod: 3, totalPrice: 4, employee: 5 };
const HISTORY_HEADER_ROW_COUNT = 1;
const HISTORY_DATA_START_ROW = HISTORY_HEADER_ROW_COUNT + 1;
const HISTORY_DATA_RANGE = `${HISTORY_SHEET_NAME_ONLY}!A${HISTORY_DATA_START_ROW}:F`;
const HISTORY_FULL_RANGE_FOR_APPEND = `${HISTORY_SHEET_NAME_ONLY}!A:F`;


// Cache for sheet GIDs to avoid repeated lookups
const sheetGidCache = {};

// Initialize Google Sheets client
const initializeSheetsClient = () => {
  try {
    if (!SHEET_ID || !PRODUCT_SHEET_NAME_ONLY || !USERS_SHEET_NAME_ONLY || !HISTORY_SHEET_NAME_ONLY) {
      throw new Error("Missing Google Sheet configuration in environment variables.");
    }

    if (SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY) {
      console.log("[GSHEET Auth] Using Service Account credentials.");
      const auth = new GoogleAuth({
        credentials: {
          client_email: SERVICE_ACCOUNT_EMAIL,
          private_key: PRIVATE_KEY,
        },
        scopes: SCOPES,
      });
      sheets = google.sheets({ version: 'v4', auth });
      console.log("[GSHEET Auth] Google Sheets client initialized successfully.");
      authError = null;
    } else {
      throw new Error("Missing Google Sheets API credentials.");
    }
  } catch (error) {
    console.error("!!! CRITICAL: Failed to initialize Google Sheets client:", error.message);
    authError = `Failed to initialize Google Sheets client: ${error.message}`;
    sheets = null;
  }
};

// Call initialization immediately
initializeSheetsClient();

// Get sheets client (re-initialize if needed)
const getSheetsClient = () => {
  if (!sheets && !authError) {
    console.warn("[GSHEET Auth] Re-initializing Google Sheets client.");
    initializeSheetsClient();
  }
  if (authError) {
    console.error(`[GSHEET Auth Error] Cannot get client: ${authError}`);
  }
  return sheets;
};

// Helper function to generate a local ID
const generateLocalId = (name, volume, rowIndex) => {
  const hashString = `${name}-${volume || 'none'}-${rowIndex}`;
  let hash = 0;
  for (let i = 0; i < hashString.length; i++) {
    const char = hashString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `prod_${Math.abs(hash).toString(16)}_${rowIndex}`;
};

// Helper to convert sheet row to Product object
const rowToProduct = (row, arrayIndex) => {
  if (!row || row.length === 0 || !row[PRODUCT_COLUMN_MAP.name]) {
    return null;
  }
  
  const name = row[PRODUCT_COLUMN_MAP.name] ?? '';
  const volume = row[PRODUCT_COLUMN_MAP.volume] || undefined;
  const priceStr = row[PRODUCT_COLUMN_MAP.price]?.toString().replace(',', '.').trim();
  const isValidPrice = /^\d+(\.\d+)?$/.test(priceStr);
  const price = isValidPrice ? parseFloat(priceStr) : undefined;
  const sheetRowIndex = arrayIndex + PRODUCT_DATA_START_ROW;

  return {
    id: generateLocalId(name, volume, sheetRowIndex),
    name,
    volume,
    price,
    imageUrl: row[PRODUCT_COLUMN_MAP.imageUrl] || undefined,
    dataAiHint: row[PRODUCT_COLUMN_MAP.dataAiHint] || undefined,
  };
};

// Helper to convert sheet row to User object
const rowToUser = (row) => {
  if (!row || row.length <= USER_COLUMN_MAP.passwordHash || !row[USER_COLUMN_MAP.login]) {
    if (row?.every(cell => cell === null || cell === '')) return null;
    console.warn(`[GSHEET User] Skipping row due to missing data:`, row);
    return null;
  }
  
  const iconColorRaw = row[USER_COLUMN_MAP.iconColor];
  const isValidColor = typeof iconColorRaw === 'string' && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(iconColorRaw);

  return {
    id: row[USER_COLUMN_MAP.id] ?? '',
    login: row[USER_COLUMN_MAP.login],
    passwordHash: row[USER_COLUMN_MAP.passwordHash],
    firstName: row[USER_COLUMN_MAP.firstName] || undefined,
    middleName: row[USER_COLUMN_MAP.middleName] || undefined,
    lastName: row[USER_COLUMN_MAP.lastName] || undefined,
    position: row[USER_COLUMN_MAP.position] || undefined,
    iconColor: isValidColor ? iconColorRaw : (iconColorRaw === '' ? undefined : iconColorRaw),
  };
};

// Helper to convert sheet row to Order object
const rowToOrder = (row): Order | null => {
  if (!row || row.length === 0 || !row[HISTORY_COLUMN_MAP.orderId] || !row[HISTORY_COLUMN_MAP.timestamp]) {
    return null;
  }

  let items: SalesHistoryItem[] = [];
  try {
    const itemsString = row[HISTORY_COLUMN_MAP.items] ?? '';
    if (itemsString.length > 0) {
        // Split items by ", " (comma and space)
        items = itemsString.split(', ').map(itemStr => {
            // Regex to match: "ProductName (ProductVolume) xQuantity" or "ProductName xQuantity"
            const itemParts = itemStr.trim().match(/^(.+?)(?:\s+\((.+?)\))?\s+x(\d+)$/);
            if (itemParts) {
                return {
                    id: `item_${Date.now()}_${Math.random()}`, // Placeholder ID
                    name: itemParts[1].trim(),
                    volume: itemParts[2]?.trim() || undefined,
                    // Price is not reliably available in this string, will be part of order.totalPrice
                    price: 0, // Set default or fetch from product list if needed elsewhere
                    quantity: parseInt(itemParts[3], 10),
                };
            }
            console.warn(`[GSHEET History] Could not parse item string: "${itemStr}" for order ${row[HISTORY_COLUMN_MAP.orderId]}`);
            return null;
        }).filter((item): item is SalesHistoryItem => item !== null);
    }
  } catch (e) {
    console.warn(`[GSHEET History] Could not parse items for order ${row[HISTORY_COLUMN_MAP.orderId]}: ${row[HISTORY_COLUMN_MAP.items]}`, e);
  }

  const totalPriceStr = row[HISTORY_COLUMN_MAP.totalPrice]?.toString().replace(',', '.').trim();
  const isValidTotalPrice = /^\d+(\.\d+)?$/.test(totalPriceStr);
  
  let timestamp = row[HISTORY_COLUMN_MAP.timestamp];
  // Check if timestamp is already in 'dd.MM.yyyy HH:mm:ss' format from the sheet
  // and attempt to parse it into a valid Date object, then to ISO string for internal consistency
  if (typeof timestamp === 'string' && /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
    try {
      const parts = timestamp.split(' ');
      const dateParts = parts[0].split('.');
      const timeParts = parts[1].split(':');
      const parsedDate = new Date(
        Number(dateParts[2]), 
        Number(dateParts[1]) - 1, 
        Number(dateParts[0]), 
        Number(timeParts[0]), 
        Number(timeParts[1]), 
        Number(timeParts[2])
      );
      if (isValidDate(parsedDate)) {
        timestamp = parsedDate.toISOString();
      } else {
        console.warn(`[GSHEET History] Parsed invalid date for order ${row[HISTORY_COLUMN_MAP.orderId]} from sheet timestamp: ${row[HISTORY_COLUMN_MAP.timestamp]}. Using original sheet value.`);
        timestamp = row[HISTORY_COLUMN_MAP.timestamp]; // Fallback to original if parsing fails or results in invalid date
      }
    } catch (e) {
        console.warn(`[GSHEET History] Could not parse sheet timestamp ${row[HISTORY_COLUMN_MAP.timestamp]} for order ${row[HISTORY_COLUMN_MAP.orderId]}. Using original value. Error:`, e);
        timestamp = row[HISTORY_COLUMN_MAP.timestamp]; // Fallback
    }
  } else if (typeof timestamp === 'string' && !isValidDate(parseISO(timestamp))) {
      console.warn(`[GSHEET History] Timestamp ${timestamp} for order ${row[HISTORY_COLUMN_MAP.orderId]} is not ISO and not 'dd.MM.yyyy HH:mm:ss'. Using original value.`);
  }


  return {
    id: row[HISTORY_COLUMN_MAP.orderId],
    timestamp: timestamp, 
    items,
    paymentMethod: row[HISTORY_COLUMN_MAP.paymentMethod] as PaymentMethod,
    totalPrice: isValidTotalPrice ? parseFloat(totalPriceStr) : 0,
    employee: row[HISTORY_COLUMN_MAP.employee] || undefined,
  };
};


// Helper to convert Product object to sheet row
const productToRow = (product) => {
  const row = Array(Object.keys(PRODUCT_COLUMN_MAP).length).fill('');
  row[PRODUCT_COLUMN_MAP.name] = product.name;
  row[PRODUCT_COLUMN_MAP.volume] = product.volume ?? '';
  row[PRODUCT_COLUMN_MAP.price] = product.price !== undefined ? String(product.price).replace('.', ',') : '';
  row[PRODUCT_COLUMN_MAP.imageUrl] = product.imageUrl ?? '';
  row[PRODUCT_COLUMN_MAP.dataAiHint] = product.dataAiHint ?? '';
  return row;
};

// Helper to convert Order object to sheet row for human-readable format
const orderToRow = (order: Order): string[] => {
  const rowValues = Array(Object.keys(HISTORY_COLUMN_MAP).length).fill('');
  rowValues[HISTORY_COLUMN_MAP.orderId] = order.id;
  
  try {
    // Order timestamp is expected to be ISO string, format it to 'dd.MM.yyyy HH:mm:ss' for the sheet
    rowValues[HISTORY_COLUMN_MAP.timestamp] = format(parseISO(order.timestamp), 'dd.MM.yyyy HH:mm:ss');
  } catch (e) {
    console.warn(`[GSHEET History] Could not format ISO timestamp ${order.timestamp} for sheet. Using original value. Error:`, e);
    rowValues[HISTORY_COLUMN_MAP.timestamp] = order.timestamp;
  }
  
  rowValues[HISTORY_COLUMN_MAP.items] = order.items.map(item => {
    let itemStr = item.name;
    if (item.volume) {
      itemStr += ` (${item.volume})`;
    }
    itemStr += ` x${item.quantity}`;
    return itemStr;
  }).join(', '); // Use ", " as separator

  rowValues[HISTORY_COLUMN_MAP.paymentMethod] = order.paymentMethod;
  rowValues[HISTORY_COLUMN_MAP.totalPrice] = String(order.totalPrice).replace('.', ',');
  rowValues[HISTORY_COLUMN_MAP.employee] = order.employee ?? '';
  return rowValues;
};


// Helper function to get the sheetId (gid) for a given sheet name
const getSheetGid = async (sheetName) => {
  if (sheetGidCache[sheetName]) {
    return sheetGidCache[sheetName];
  }

  const currentSheets = getSheetsClient();
  if (!currentSheets) return null;

  try {
    const response = await currentSheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      fields: 'sheets(properties(sheetId,title))',
    });
    
    const sheetProperties = response.data.sheets?.find(
      (sheet) => sheet.properties?.title === sheetName
    )?.properties;

    if (sheetProperties?.sheetId !== undefined) {
      sheetGidCache[sheetName] = sheetProperties.sheetId;
      return sheetProperties.sheetId;
    }
    
    console.error(`[GSHEET] Could not find sheetId for sheet "${sheetName}"`);
    return null;
  } catch (error) {
    console.error(`[GSHEET] Error fetching sheetId for "${sheetName}":`, error?.message || error);
    return null;
  }
};

// Helper to find row index by column value
const findRowIndexByColumnValue = async (sheetNameOnly, columnIndex, valueToFind, startRow) => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) return null;

  const columnLetter = String.fromCharCode('A'.charCodeAt(0) + columnIndex);
  const range = `${sheetNameOnly}!${columnLetter}${startRow}:${columnLetter}`;
  const logPrefix = sheetNameOnly === PRODUCT_SHEET_NAME_ONLY ? '[GSHEET Product]' : 
                    sheetNameOnly === USERS_SHEET_NAME_ONLY ? '[GSHEET User]' : '[GSHEET History]';

  try {
    console.log(`${logPrefix} Searching for "${valueToFind}" in column ${columnLetter}`);
    const response = await currentSheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range,
    });
    
    const rows = response.data.values;
    if (!rows) {
      console.log(`${logPrefix} No data rows found in column ${columnLetter}.`);
      return null;
    }

    const indexInData = rows.findIndex(row => row[0] === valueToFind);
    if (indexInData !== -1) {
      const sheetRowIndex = indexInData + startRow;
      console.log(`${logPrefix} Found match at row: ${sheetRowIndex}`);
      return sheetRowIndex;
    }
    
    console.log(`${logPrefix} Match not found for "${valueToFind}".`);
    return null;
  } catch (error) {
    console.error(`${logPrefix} Error finding row for "${valueToFind}":`, error?.message || error);
    return null;
  }
};

// Helper to find product row by name and volume
const findProductRowIndexByNameAndVolume = async (name, volume) => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) return null;
  const searchVolume = volume ?? '';

  try {
    console.log(`[GSHEET Product] Searching for Name: "${name}", Volume: "${searchVolume}"`);
    const response = await currentSheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${PRODUCT_SHEET_NAME_ONLY}!A${PRODUCT_DATA_START_ROW}:B`,
    });
    
    const rows = response.data.values;
    if (!rows) {
      console.log("[GSHEET Product] No data rows found.");
      return null;
    }

    const indexInData = rows.findIndex(row =>
      row[PRODUCT_COLUMN_MAP.name] === name &&
      (row[PRODUCT_COLUMN_MAP.volume] ?? '') === searchVolume
    );

    if (indexInData !== -1) {
      const sheetRowIndex = indexInData + PRODUCT_DATA_START_ROW;
      console.log(`[GSHEET Product] Found match at row: ${sheetRowIndex}`);
      return sheetRowIndex;
    }
    
    console.log(`[GSHEET Product] Match not found.`);
    return null;
  } catch (error) {
    console.error(`[GSHEET Product] Error finding row:`, error?.message || error);
    return null;
  }
};

// --- Product API ---

// Fetch products from sheet
export const fetchProductsFromSheet = async (): Promise<Product[]> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) {
    throw new Error(`Google Sheets client not initialized. Auth error: ${authError}`);
  }

  try {
    console.log(`[GSHEET Product] Fetching products from range: ${PRODUCT_DATA_RANGE}`);
    const response = await currentSheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: PRODUCT_DATA_RANGE,
    });

    const rows = response.data.values;
    if (!rows) {
      console.log("[GSHEET Product] No data found.");
      return [];
    }

    console.log(`[GSHEET Product] Fetched ${rows.length} rows.`);
    return rows
      .map((row, index) => rowToProduct(row, index))
      .filter(Boolean) as Product[]; // Type assertion
  } catch (error) {
    console.error('[GSHEET Product] Error fetching products:', error?.message || error);
    throw new Error('Failed to fetch products. Check permissions and config.');
  }
};

// Add product to sheet
export const addProductToSheet = async (product: Omit<Product, 'id'>): Promise<boolean> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) return false;

  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
    console.error('[GSHEET Product] Add operation requires Service Account credentials.');
    return false;
  }
  
  if (!product.name) {
    console.error('[GSHEET Product] Attempted to add product without a name.');
    return false;
  }

  try {
    console.log(`[GSHEET Product] Adding product: "${product.name}", "${product.volume || ''}"`);
    const existingRowIndex = await findProductRowIndexByNameAndVolume(product.name, product.volume);
    if (existingRowIndex !== null) {
      console.warn(`[GSHEET Product] Product "${product.name}" (${product.volume || 'N/A'}) already exists. Skipping.`);
      return false; // Indicate product already exists or skip
    }

    await currentSheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: PRODUCT_FULL_RANGE_FOR_APPEND,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [productToRow(product)],
      },
    });
    
    console.log(`[GSHEET Product] Successfully added product.`);
    return true;
  } catch (error) {
    console.error(`[GSHEET Product] Error adding product:`, error?.message || error);
    return false;
  }
};

// Update product in sheet
export const updateProductInSheet = async ({ originalName, originalVolume, newData }: { originalName: string, originalVolume?: string, newData: Omit<Product, 'id'> }): Promise<boolean> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) return false;

  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
    console.error('[GSHEET Product] Update requires Service Account credentials.');
    return false;
  }
  
  if (!originalName || !newData.name) {
    console.error('[GSHEET Product] Original or new product name missing.');
    return false;
  }

  try {
    console.log(`[GSHEET Product] Updating product: "${originalName}", "${originalVolume || ''}"`);
    const rowIndex = await findProductRowIndexByNameAndVolume(originalName, originalVolume);
    if (rowIndex === null) {
      console.error(`[GSHEET Product] Product not found for update.`);
      return false;
    }

    // Check for conflicts if name/volume changes
    if (newData.name !== originalName || (newData.volume ?? '') !== (originalVolume ?? '')) {
      const potentialConflictIndex = await findProductRowIndexByNameAndVolume(newData.name, newData.volume);
      if (potentialConflictIndex !== null && potentialConflictIndex !== rowIndex) {
        console.warn(`[GSHEET Product] Update conflict: Product with new name/volume already exists at row ${potentialConflictIndex}.`);
        return false;
      }
    }

    const range = `${PRODUCT_SHEET_NAME_ONLY}!A${rowIndex}:E${rowIndex}`;
    await currentSheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [productToRow(newData)],
      },
    });
    
    console.log(`[GSHEET Product] Successfully updated product.`);
    return true;
  } catch (error) {
    console.error(`[GSHEET Product] Error updating product:`, error?.message || error);
    return false;
  }
};

// Delete product from sheet
export const deleteProductFromSheet = async ({ name, volume }: { name: string, volume?: string }): Promise<boolean> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) return false;

  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
    console.error('[GSHEET Product] Delete requires Service Account credentials.');
    return false;
  }
  
  if (!name) {
    console.error('[GSHEET Product] Attempted to delete product without a name.');
    return false;
  }

  try {
    console.log(`[GSHEET Product] Deleting product: "${name}", "${volume || ''}"`);
    const rowIndex = await findProductRowIndexByNameAndVolume(name, volume);
    if (rowIndex === null) {
      console.error(`[GSHEET Product] Product not found for deletion.`);
      return false;
    }

    const sheetGid = await getSheetGid(PRODUCT_SHEET_NAME_ONLY);
    if (sheetGid === null) {
      console.error(`[GSHEET Product] Could not determine sheetId for "${PRODUCT_SHEET_NAME_ONLY}". Aborting deletion.`);
      return false;
    }

    await currentSheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetGid,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // Google Sheets API is 0-indexed for batchUpdate ranges
              endIndex: rowIndex,
            },
          },
        }],
      },
    });
    
    console.log(`[GSHEET Product] Successfully deleted product.`);
    return true;
  } catch (error) {
    console.error(`[GSHEET Product] Error deleting product:`, error?.message || error);
    return false;
  }
};

// Sync raw products to sheet
export const syncRawProductsToSheet = async () => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) {
    return { 
      success: false, 
      message: `Google Sheets client not initialized. Auth error: ${authError}`, 
      addedCount: 0, 
      skippedCount: 0 
    };
  }
  
  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
    return { 
      success: false, 
      message: "Sync operation requires Service Account credentials.", 
      addedCount: 0, 
      skippedCount: 0 
    };
  }

  console.log("[GSHEET Product] Starting sync of raw products...");

  try {
    const rawProducts = getRawProductData();
    console.log(`[GSHEET Product] Found ${rawProducts.length} raw products for sync.`);

    const existingProducts = await fetchProductsFromSheet();
    const existingProductKeys = new Set(
      existingProducts.map(p => `${p.name}|${p.volume ?? ''}`)
    );
    
    const productsToAdd = rawProducts.filter(
      rp => !existingProductKeys.has(`${rp.name}|${rp.volume ?? ''}`)
    );
    const skippedCount = rawProducts.length - productsToAdd.length;

    console.log(`[GSHEET Product] Products to add: ${productsToAdd.length}, Skipped (already exist): ${skippedCount}`);

    if (productsToAdd.length === 0) {
      return { 
        success: true, 
        message: "All example products are already in the sheet.", 
        addedCount: 0, 
        skippedCount 
      };
    }

    await currentSheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: PRODUCT_FULL_RANGE_FOR_APPEND, // Append to the end of the sheet
      valueInputOption: 'USER_ENTERED', // So formulas and number formatting work
      insertDataOption: 'INSERT_ROWS', // Insert new rows for the data
      requestBody: {
        values: productsToAdd.map(productToRow),
      },
    });

    return { 
      success: true, 
      message: `Successfully added ${productsToAdd.length} example products to Google Sheet.`, 
      addedCount: productsToAdd.length, 
      skippedCount 
    };
  } catch (error) {
    console.error('[GSHEET Product] Error syncing raw products:', error?.message || error);
    return { 
      success: false, 
      message: `Failed to sync example products to Google Sheet. ${error?.message || 'Unknown error'}`, 
      addedCount: 0, 
      skippedCount: 0 
    };
  }
};

// --- User Authentication Functions ---

// Get user data from sheet
export const getUserDataFromSheet = async (login: string): Promise<User | null> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) return null;

  try {
    console.log(`[GSHEET User] Fetching user data for: ${login}`);
    const response = await currentSheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: USER_DATA_RANGE,
    });

    const rows = response.data.values;
    if (!rows) {
      console.log(`[GSHEET User] No users found in sheet "${USERS_SHEET_NAME_ONLY}".`);
      return null;
    }

    const userRow = rows.find(row => row[USER_COLUMN_MAP.login] === login);
    if (!userRow) {
      console.log(`[GSHEET User] User "${login}" not found.`);
      return null;
    }

    return rowToUser(userRow);
  } catch (error) {
    console.error(`[GSHEET User] Error fetching user "${login}":`, error?.message || error);
    return null;
  }
};

// Verify password
export const verifyPassword = async (inputPassword, storedHash) => {
  // TODO: Replace with actual hashing comparison (e.g., bcrypt.compare)
  console.warn("[Security] Comparing passwords in plain text. IMPLEMENT HASHING!");
  return inputPassword === storedHash;
};

// Find user row by login
const findUserRowIndexByLogin = async (login) => {
  return findRowIndexByColumnValue(
    USERS_SHEET_NAME_ONLY, 
    USER_COLUMN_MAP.login, 
    login, 
    USER_DATA_START_ROW
  );
};

// Update user in sheet
export const updateUserInSheet = async (originalLogin: string, updates: Partial<User>): Promise<boolean> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) return false;

  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
    console.error('[GSHEET User] Update requires Service Account credentials.');
    return false;
  }
  
  if (!originalLogin) {
    console.error('[GSHEET User] Original login missing for update.');
    return false;
  }

  try {
    console.log(`[GSHEET User] Updating user: "${originalLogin}" with updates:`, updates);
    const rowIndex = await findUserRowIndexByLogin(originalLogin);
    if (rowIndex === null) {
      console.error(`[GSHEET User] User "${originalLogin}" not found for update.`);
      return false;
    }

    const userRowRange = `${USERS_SHEET_NAME_ONLY}!A${rowIndex}:${String.fromCharCode('A'.charCodeAt(0) + Object.keys(USER_COLUMN_MAP).length - 1)}${rowIndex}`;
    const currentUserDataRowResponse = await currentSheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: userRowRange,
    });
    
    const currentUserDataRow = currentUserDataRowResponse.data.values?.[0];
    if (!currentUserDataRow) {
      console.error(`[GSHEET User] Could not fetch current data for user "${originalLogin}".`);
      return false;
    }

    // Create updated row based on current data, then apply updates
    const updatedRow = [...currentUserDataRow];
    // Ensure row has enough columns
    while (updatedRow.length < Object.keys(USER_COLUMN_MAP).length) {
      updatedRow.push('');
    }
    
    if (updates.login !== undefined) updatedRow[USER_COLUMN_MAP.login] = updates.login;
    if (updates.passwordHash !== undefined) updatedRow[USER_COLUMN_MAP.passwordHash] = updates.passwordHash;
    if (updates.firstName !== undefined) updatedRow[USER_COLUMN_MAP.firstName] = updates.firstName || '';
    if (updates.middleName !== undefined) updatedRow[USER_COLUMN_MAP.middleName] = updates.middleName || '';
    if (updates.lastName !== undefined) updatedRow[USER_COLUMN_MAP.lastName] = updates.lastName || '';
    if (updates.position !== undefined) updatedRow[USER_COLUMN_MAP.position] = updates.position || '';
    if (updates.iconColor !== undefined) updatedRow[USER_COLUMN_MAP.iconColor] = updates.iconColor || '';

    // Check login conflict if login is being changed
    if (updates.login && updates.login !== originalLogin) {
      const newLoginIndex = await findUserRowIndexByLogin(updates.login);
      if (newLoginIndex !== null && newLoginIndex !== rowIndex) { // Check if new login exists AND it's not the current user's row
        console.warn(`[GSHEET User] Update conflict: New login "${updates.login}" already exists for another user.`);
        return false; // Or throw an error to indicate conflict
      }
    }

    await currentSheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: userRowRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [updatedRow],
      },
    });

    console.log(`[GSHEET User] Successfully updated user "${originalLogin}". New login (if changed): "${updates.login || originalLogin}".`);
    return true;
  } catch (error) {
    console.error(`[GSHEET User] Error updating user "${originalLogin}":`, error?.message || error);
    return false;
  }
};


// --- Sales History Functions ---

// Fetch all orders from history sheet
export const fetchOrdersFromSheet = async (): Promise<Order[]> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) {
    throw new Error(`Google Sheets client not initialized. Auth error: ${authError}`);
  }

  try {
    console.log(`[GSHEET History] Fetching orders from range: ${HISTORY_DATA_RANGE}`);
    const response = await currentSheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: HISTORY_DATA_RANGE,
    });

    const rows = response.data.values;
    if (!rows) {
      console.log("[GSHEET History] No data found.");
      return [];
    }

    console.log(`[GSHEET History] Fetched ${rows.length} rows.`);
    return rows.map(rowToOrder).filter(Boolean) as Order[];
  } catch (error) {
    console.error('[GSHEET History] Error fetching orders:', error?.message || error);
    throw new Error('Failed to fetch orders. Check permissions and config.');
  }
};

// Add an order to history sheet
export const addOrderToSheet = async (order: Order): Promise<boolean> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) return false;

  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
    console.error('[GSHEET History] Add operation requires Service Account credentials.');
    return false;
  }
  
  if (!order.id) {
    console.error('[GSHEET History] Attempted to add order without an ID.');
    return false;
  }

  try {
    console.log(`[GSHEET History] Adding order: "${order.id}"`);

    await currentSheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: HISTORY_FULL_RANGE_FOR_APPEND,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [orderToRow(order)],
      },
    });
    
    console.log(`[GSHEET History] Successfully added order "${order.id}".`);
    return true;
  } catch (error) {
    console.error(`[GSHEET History] Error adding order "${order.id}":`, error?.message || error);
    return false;
  }
};

// Delete an order from history sheet by ID
export const deleteOrderFromSheet = async (orderId: string): Promise<boolean> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) return false;

  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
    console.error('[GSHEET History] Delete operation requires Service Account credentials.');
    return false;
  }
  
  if (!orderId) {
    console.error('[GSHEET History] Attempted to delete order without an ID.');
    return false;
  }

  try {
    console.log(`[GSHEET History] Deleting order: "${orderId}"`);
    const rowIndex = await findRowIndexByColumnValue(HISTORY_SHEET_NAME_ONLY, HISTORY_COLUMN_MAP.orderId, orderId, HISTORY_DATA_START_ROW);
    if (rowIndex === null) {
      console.error(`[GSHEET History] Order with ID "${orderId}" not found for deletion.`);
      return false;
    }

    const sheetGid = await getSheetGid(HISTORY_SHEET_NAME_ONLY);
    if (sheetGid === null) {
      console.error(`[GSHEET History] Could not determine sheetId for "${HISTORY_SHEET_NAME_ONLY}". Aborting deletion.`);
      return false;
    }

    await currentSheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetGid,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, 
              endIndex: rowIndex,
            },
          },
        }],
      },
    });
    
    console.log(`[GSHEET History] Successfully deleted order "${orderId}".`);
    return true;
  } catch (error) {
    console.error(`[GSHEET History] Error deleting order "${orderId}":`, error?.message || error);
    return false;
  }
};

// Clear all orders from history sheet (leaves header row)
export const clearAllOrdersFromSheet = async (): Promise<boolean> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) return false;

  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
    console.error('[GSHEET History] Clear all operation requires Service Account credentials.');
    return false;
  }

  try {
    console.log(`[GSHEET History] Clearing all orders from sheet "${HISTORY_SHEET_NAME_ONLY}".`);
    
    const sheetGid = await getSheetGid(HISTORY_SHEET_NAME_ONLY);
    if (sheetGid === null) {
      console.error(`[GSHEET History] Could not determine sheetId for "${HISTORY_SHEET_NAME_ONLY}". Aborting clear operation.`);
      return false;
    }
    
    const sheetMetadata = await currentSheets.spreadsheets.get({
        spreadsheetId: SHEET_ID,
        ranges: [HISTORY_SHEET_NAME_ONLY],
        fields: 'sheets(properties(gridProperties(rowCount)))',
    });

    const currentSheetInfo = sheetMetadata.data.sheets?.find(s => s.properties?.title === HISTORY_SHEET_NAME_ONLY);
    const totalRows = currentSheetInfo?.properties?.gridProperties?.rowCount;

    if (!totalRows || totalRows <= HISTORY_HEADER_ROW_COUNT) {
        console.log('[GSHEET History] No data rows to clear.');
        return true;
    }

    const rangeToClear = `${HISTORY_SHEET_NAME_ONLY}!A${HISTORY_DATA_START_ROW}:F${totalRows}`;
    
    await currentSheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: rangeToClear,
    });
    
    console.log(`[GSHEET History] Successfully cleared all orders from sheet "${HISTORY_SHEET_NAME_ONLY}".`);
    return true;
  } catch (error) {
    console.error(`[GSHEET History] Error clearing all orders:`, error?.message || error);
    return false;
  }
};
