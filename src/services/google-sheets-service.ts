'use server';
/**
 * @fileoverview Service for interacting with the Google Sheets API using Service Account authentication.
 * Provides functions to fetch, add, update, and delete product data,
 * assuming a sheet structure: Name | Volume | Price | Image URL | Hint
 * Also provides functions for user authentication and data retrieval/update.
 */
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import type { Product } from '@/types/product';
import type { User } from '@/types/user';
import { getRawProductData } from '@/lib/product-defaults';

// --- Service Account Authentication ---
const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_SHEET_ID: SHEET_ID,
  GOOGLE_SHEET_NAME: PRODUCT_SHEET_NAME_ONLY,
  GOOGLE_USERS_SHEET_NAME: USERS_SHEET_NAME_ONLY,
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

// Cache for sheet GIDs to avoid repeated lookups
const sheetGidCache = {};

// Initialize Google Sheets client
const initializeSheetsClient = () => {
  try {
    if (!SHEET_ID || !PRODUCT_SHEET_NAME_ONLY || !USERS_SHEET_NAME_ONLY) {
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

// Helper to convert Product object to sheet row
const productToRow = (product) => {
  const row = Array(Object.keys(PRODUCT_COLUMN_MAP).length).fill('');
  row[PRODUCT_COLUMN_MAP.name] = product.name;
  row[PRODUCT_COLUMN_MAP.volume] = product.volume ?? '';
  row[PRODUCT_COLUMN_MAP.price] = product.price !== undefined ? product.price : '';
  row[PRODUCT_COLUMN_MAP.imageUrl] = product.imageUrl ?? '';
  row[PRODUCT_COLUMN_MAP.dataAiHint] = product.dataAiHint ?? '';
  return row;
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
  const logPrefix = sheetNameOnly === PRODUCT_SHEET_NAME_ONLY ? '[GSHEET Product]' : '[GSHEET User]';

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

// --- Public API ---

// Fetch products from sheet
export const fetchProductsFromSheet = async () => {
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
      .filter(Boolean);
  } catch (error) {
    console.error('[GSHEET Product] Error fetching products:', error?.message || error);
    throw new Error('Failed to fetch products. Check permissions and config.');
  }
};

// Add product to sheet
export const addProductToSheet = async (product) => {
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
      console.warn(`[GSHEET Product] Product already exists. Skipping.`);
      return false;
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
export const updateProductInSheet = async ({ originalName, originalVolume, newData }) => {
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
        console.warn(`[GSHEET Product] Update conflict: Product exists at row ${potentialConflictIndex}.`);
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
export const deleteProductFromSheet = async ({ name, volume }) => {
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
      console.error(`[GSHEET Product] Could not determine sheetId. Aborting.`);
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

  console.log("[GSHEET Product] Starting sync...");

  try {
    const rawProducts = getRawProductData();
    console.log(`[GSHEET Product] Found ${rawProducts.length} raw products.`);

    const existingProducts = await fetchProductsFromSheet();
    const existingProductKeys = new Set(
      existingProducts.map(p => `${p.name}|${p.volume ?? ''}`)
    );
    
    const productsToAdd = rawProducts.filter(
      rp => !existingProductKeys.has(`${rp.name}|${rp.volume ?? ''}`)
    );
    const skippedCount = rawProducts.length - productsToAdd.length;

    console.log(`[GSHEET Product] To add: ${productsToAdd.length}, Skipped: ${skippedCount}`);

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
      range: PRODUCT_FULL_RANGE_FOR_APPEND,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: productsToAdd.map(productToRow),
      },
    });

    return { 
      success: true, 
      message: `Added ${productsToAdd.length} example products.`, 
      addedCount: productsToAdd.length, 
      skippedCount 
    };
  } catch (error) {
    console.error('[GSHEET Product] Error syncing products:', error?.message || error);
    return { 
      success: false, 
      message: `Failed to sync. ${error?.message || 'Unknown error'}`, 
      addedCount: 0, 
      skippedCount: 0 
    };
  }
};

// --- User Authentication Functions ---

// Get user data from sheet
export const getUserDataFromSheet = async (login) => {
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
      console.log(`[GSHEET User] No users found.`);
      return null;
    }

    const userRow = rows.find(row => row[USER_COLUMN_MAP.login] === login);
    if (!userRow) {
      console.log(`[GSHEET User] User not found.`);
      return null;
    }

    return rowToUser(userRow);
  } catch (error) {
    console.error(`[GSHEET User] Error fetching user:`, error?.message || error);
    return null;
  }
};

// Verify password
export const verifyPassword = async (inputPassword, storedHash) => {
  // TODO: Replace with actual hashing comparison
  console.warn("[Security] Comparing passwords in plain text. Replace with hashing!");
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
export const updateUserInSheet = async (originalLogin, updates) => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) return false;

  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
    console.error('[GSHEET User] Update requires Service Account credentials.');
    return false;
  }
  
  if (!originalLogin) {
    console.error('[GSHEET User] Original login missing.');
    return false;
  }

  try {
    console.log(`[GSHEET User] Updating user: "${originalLogin}"`);
    const rowIndex = await findUserRowIndexByLogin(originalLogin);
    if (rowIndex === null) {
      console.error(`[GSHEET User] User not found.`);
      return false;
    }

    const userRowRange = `${USERS_SHEET_NAME_ONLY}!A${rowIndex}:H${rowIndex}`;
    const currentUserDataRowResponse = await currentSheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: userRowRange,
    });
    
    const currentUserDataRow = currentUserDataRowResponse.data.values?.[0];
    if (!currentUserDataRow) {
      console.error(`[GSHEET User] Could not fetch current data.`);
      return false;
    }

    // Create updated row
    const updatedRow = Array(Object.keys(USER_COLUMN_MAP).length).fill(null);
    currentUserDataRow.forEach((value, index) => {
      if (index < updatedRow.length) updatedRow[index] = value ?? '';
    });

    // Apply updates
    if (updates.login !== undefined) updatedRow[USER_COLUMN_MAP.login] = updates.login;
    if (updates.passwordHash !== undefined) updatedRow[USER_COLUMN_MAP.passwordHash] = updates.passwordHash;
    if (updates.firstName !== undefined) updatedRow[USER_COLUMN_MAP.firstName] = updates.firstName || '';
    if (updates.middleName !== undefined) updatedRow[USER_COLUMN_MAP.middleName] = updates.middleName || '';
    if (updates.lastName !== undefined) updatedRow[USER_COLUMN_MAP.lastName] = updates.lastName || '';
    if (updates.position !== undefined) updatedRow[USER_COLUMN_MAP.position] = updates.position || '';
    if (updates.iconColor !== undefined) updatedRow[USER_COLUMN_MAP.iconColor] = updates.iconColor || '';

    // Check login conflict
    if (updates.login && updates.login !== originalLogin) {
      const newLoginIndex = await findUserRowIndexByLogin(updates.login);
      if (newLoginIndex !== null && newLoginIndex !== rowIndex) {
        console.warn(`[GSHEET User] Update conflict: Login exists for another user.`);
        return false;
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

    console.log(`[GSHEET User] Successfully updated user.`);
    return true;
  } catch (error) {
    console.error(`[GSHEET User] Error updating user:`, error?.message || error);
    return false;
  }
};
