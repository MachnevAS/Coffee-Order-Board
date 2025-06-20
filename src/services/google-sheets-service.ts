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
import bcrypt from 'bcrypt';
import type { Product } from '@/types/product';
import type { User } from '@/types/user';
import type { Order, SalesHistoryItem, PaymentMethod } from '@/types/order';
import { getRawProductData } from '@/lib/product-defaults';
import { format, parse, parseISO, isValid as isValidDate } from 'date-fns';
import { ru } from 'date-fns/locale';

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

let sheets: any = null; 
let authError: string | null = null;

// --- Constants and Helpers ---
const PRODUCT_COLUMN_MAP = { name: 0, volume: 1, price: 2, imageUrl: 3, dataAiHint: 4 };
const PRODUCT_HEADER_ROW_COUNT = 1;
const PRODUCT_DATA_START_ROW = PRODUCT_HEADER_ROW_COUNT + 1;
const PRODUCT_DATA_RANGE = `${PRODUCT_SHEET_NAME_ONLY}!A${PRODUCT_DATA_START_ROW}:E`;
const PRODUCT_FULL_RANGE_FOR_APPEND = `${PRODUCT_SHEET_NAME_ONLY}!A:E`;

const USER_COLUMN_MAP = { id: 0, login: 1, passwordHash: 2, firstName: 3, middleName: 4, lastName: 5, position: 6, iconColor: 7 };
const USER_HEADER_ROW_COUNT = 1;
const USER_DATA_START_ROW = USER_HEADER_ROW_COUNT + 1;
const USER_DATA_RANGE = `${USERS_SHEET_NAME_ONLY}!A${USER_DATA_START_ROW}:H`;

const HISTORY_COLUMN_MAP = { orderId: 0, timestamp: 1, items: 2, paymentMethod: 3, totalPrice: 4, employee: 5 };
const HISTORY_HEADER_ROW_COUNT = 1;
const HISTORY_DATA_START_ROW = HISTORY_HEADER_ROW_COUNT + 1;
const HISTORY_DATA_RANGE = `${HISTORY_SHEET_NAME_ONLY}!A${HISTORY_DATA_START_ROW}:F`;
const HISTORY_FULL_RANGE_FOR_APPEND = `${HISTORY_SHEET_NAME_ONLY}!A:F`;


const sheetGidCache: Record<string, number | null> = {};

const SALT_ROUNDS = 10;
const BCRYPT_PREFIX_1 = "$2a$";
const BCRYPT_PREFIX_2 = "$2b$";


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
  } catch (error: any) {
    console.error("!!! CRITICAL: Failed to initialize Google Sheets client:", error.message);
    authError = `Failed to initialize Google Sheets client: ${error.message}`;
    sheets = null;
  }
};

initializeSheetsClient();

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

const generateLocalId = (name: string, volume: string | undefined, rowIndex: number) => {
  const hashString = `${name}-${volume || 'none'}-${rowIndex}`;
  let hash = 0;
  for (let i = 0; i < hashString.length; i++) {
    const char = hashString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `prod_${Math.abs(hash).toString(16)}_${rowIndex}`;
};

const rowToProduct = (row: any[], arrayIndex: number): Product | null => {
  if (!row || row.length === 0 || !row[PRODUCT_COLUMN_MAP.name]) {
    return null;
  }
  
  const name = row[PRODUCT_COLUMN_MAP.name] ?? '';
  const volume = row[PRODUCT_COLUMN_MAP.volume] || undefined;
  const priceStr = row[PRODUCT_COLUMN_MAP.price]?.toString().replace(',', '.').trim();
  const isValidPrice = /^\d*([.,]\d+)?$/.test(priceStr); 
  const price = priceStr === '' ? undefined : (isValidPrice ? parseFloat(priceStr.replace(',', '.')) : undefined);
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

const rowToUser = (row: any[]): User | null => {
  if (!row || row.length <= USER_COLUMN_MAP.passwordHash || !row[USER_COLUMN_MAP.login]) {
    if (row?.every(cell => cell === null || cell === '')) return null;
    console.warn(`[GSHEET User] Skipping row due to missing data:`, row);
    return null;
  }
  
  const iconColorRaw = row[USER_COLUMN_MAP.iconColor];
  const isValidColor = typeof iconColorRaw === 'string' && /^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(iconColorRaw);

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

const rowToOrder = (row: any[]): Order | null => {
  if (!row || row.length === 0 || !row[HISTORY_COLUMN_MAP.orderId] || !row[HISTORY_COLUMN_MAP.timestamp]) {
    return null;
  }

  let items: SalesHistoryItem[] = [];
  try {
    const itemsString = row[HISTORY_COLUMN_MAP.items] ?? '';
    if (itemsString.length > 0) {
        items = itemsString.split(', ').map((itemStr: string) => {
            const itemParts = itemStr.trim().match(/^(.+?)(?:\s+\((.+?)\))?\s+x(\d+)$/);
            if (itemParts) {
                return {
                    id: `item_${Date.now()}_${Math.random()}`, 
                    name: itemParts[1].trim(),
                    volume: itemParts[2]?.trim() || undefined,
                    price: 0, 
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
  
  // Directly use the timestamp string from the sheet.
  // The client-side will handle parsing this "dd.MM.yyyy HH:mm:ss" string for sorting.
  const timestampValue = row[HISTORY_COLUMN_MAP.timestamp]; 
  if (typeof timestampValue !== 'string' || !/^\d{1,2}\.\d{1,2}\.\d{4}\s\d{1,2}:\d{1,2}:\d{1,2}$/.test(timestampValue)) {
    console.warn(`[GSHEET History] Timestamp for order ${row[HISTORY_COLUMN_MAP.orderId]} is not in expected "dd.MM.yyyy HH:mm:ss" format: "${timestampValue}". Using as is.`);
  }


  return {
    id: row[HISTORY_COLUMN_MAP.orderId],
    timestamp: timestampValue, 
    items,
    paymentMethod: row[HISTORY_COLUMN_MAP.paymentMethod] as PaymentMethod,
    totalPrice: isValidTotalPrice ? parseFloat(totalPriceStr) : 0,
    employee: row[HISTORY_COLUMN_MAP.employee] || undefined,
  };
};

const productToRow = (product: Omit<Product, 'id'>): string[] => {
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
  
  // Ensure timestamp is in "dd.MM.yyyy HH:mm:ss" format before sending to sheet
  let sheetTimestamp = order.timestamp; // Assume it's already correctly formatted by the client
  
  try {
      // Attempt to parse and reformat IF it's an ISO string or potentially another common format
      // This is a safety net, but ideally client sends it in "dd.MM.yyyy HH:mm:ss"
      if (isValidDate(parseISO(order.timestamp))) { 
          sheetTimestamp = format(parseISO(order.timestamp), 'dd.MM.yyyy HH:mm:ss', { locale: ru });
      } else if (!/^\d{1,2}\.\d{1,2}\.\d{4}\s\d{1,2}:\d{1,2}:\d{1,2}$/.test(order.timestamp)) {
           // Try parsing other formats if not ISO and not already in target format
           const parsedDate = parse(order.timestamp, 'dd.MM.yyyy HH:mm:ss', new Date(), { locale: ru }); // Try this first
           if (isValidDate(parsedDate)) {
               sheetTimestamp = format(parsedDate, 'dd.MM.yyyy HH:mm:ss', { locale: ru });
           } else {
               // Fallback for other potential client-side Date.toString() like formats
               const genericParsedDate = new Date(order.timestamp);
               if (isValidDate(genericParsedDate)) {
                   sheetTimestamp = format(genericParsedDate, 'dd.MM.yyyy HH:mm:ss', { locale: ru });
               } else {
                    console.warn(`[GSHEET History] orderToRow: Could not parse order.timestamp "${order.timestamp}" into a valid date. Using as is or a default.`);
                    // If all parsing fails, use current time as a last resort if order.timestamp is completely unparsable
                    // or stick with the original problematic timestamp if strict adherence is needed.
                    // For now, let's log and use the original if it's a string, or now() if it's not.
                    if(typeof order.timestamp !== 'string') {
                        sheetTimestamp = format(new Date(), 'dd.MM.yyyy HH:mm:ss', { locale: ru });
                    }
               }
           }
      }
  } catch (e) {
      console.warn(`[GSHEET History] orderToRow: Error formatting order.timestamp "${order.timestamp}". Using original or default.`, e);
      if(typeof order.timestamp !== 'string') {
           sheetTimestamp = format(new Date(), 'dd.MM.yyyy HH:mm:ss', { locale: ru });
      }
  }

  rowValues[HISTORY_COLUMN_MAP.timestamp] = sheetTimestamp; 
  
  rowValues[HISTORY_COLUMN_MAP.items] = order.items.map(item => {
    let itemStr = item.name;
    if (item.volume) {
      itemStr += ` (${item.volume})`;
    }
    itemStr += ` x${item.quantity}`;
    return itemStr;
  }).join(', ');

  rowValues[HISTORY_COLUMN_MAP.paymentMethod] = order.paymentMethod;
  rowValues[HISTORY_COLUMN_MAP.totalPrice] = String(order.totalPrice).replace('.', ',');
  rowValues[HISTORY_COLUMN_MAP.employee] = order.employee ?? '';
  return rowValues;
};

const getSheetGid = async (sheetName: string): Promise<number | null> => {
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
      (sheet: any) => sheet.properties?.title === sheetName
    )?.properties;

    if (sheetProperties?.sheetId !== undefined) {
      sheetGidCache[sheetName] = sheetProperties.sheetId;
      return sheetProperties.sheetId;
    }
    
    console.error(`[GSHEET] Could not find sheetId for sheet "${sheetName}"`);
    return null;
  } catch (error: any) {
    console.error(`[GSHEET] Error fetching sheetId for "${sheetName}":`, error?.message || error);
    return null;
  }
};

const findRowIndexByColumnValue = async (sheetNameOnly: string, columnIndex: number, valueToFind: string, startRow: number): Promise<number | null> => {
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

    const indexInData = rows.findIndex((row: any[]) => row[0] === valueToFind);
    if (indexInData !== -1) {
      const sheetRowIndex = indexInData + startRow;
      console.log(`${logPrefix} Found match at row: ${sheetRowIndex}`);
      return sheetRowIndex;
    }
    
    console.log(`${logPrefix} Match not found for "${valueToFind}".`);
    return null;
  } catch (error: any) {
    console.error(`${logPrefix} Error finding row for "${valueToFind}":`, error?.message || error);
    return null;
  }
};

const findProductRowIndexByNameAndVolume = async (name: string, volume?: string): Promise<number | null> => {
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

    const indexInData = rows.findIndex((row: any[]) =>
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
  } catch (error: any) {
    console.error(`[GSHEET Product] Error finding row:`, error?.message || error);
    return null;
  }
};

// --- Product API ---
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
      .map((row: any[], index: number) => rowToProduct(row, index))
      .filter(Boolean) as Product[];
  } catch (error: any) {
    console.error('[GSHEET Product] Error fetching products:', error?.message || error);
    throw new Error('Failed to fetch products. Check permissions and config.');
  }
};

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
  } catch (error: any) {
    console.error(`[GSHEET Product] Error adding product:`, error?.message || error);
    return false;
  }
};

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
  } catch (error: any) {
    console.error(`[GSHEET Product] Error updating product:`, error?.message || error);
    return false;
  }
};

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
              startIndex: rowIndex - 1, 
              endIndex: rowIndex,
            },
          },
        }],
      },
    });
    console.log(`[GSHEET Product] Successfully deleted product.`);
    return true;
  } catch (error: any) {
    console.error(`[GSHEET Product] Error deleting product:`, error?.message || error);
    return false;
  }
};

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
      range: PRODUCT_FULL_RANGE_FOR_APPEND, 
      valueInputOption: 'USER_ENTERED', 
      insertDataOption: 'INSERT_ROWS', 
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
  } catch (error: any) {
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

export const hashPassword = async (plainPassword: string): Promise<string> => {
  console.log("[Security] Hashing password with bcrypt.");
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
};

export const getUserDataFromSheet = async (login: string): Promise<User | null> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) return null;
  try {
    console.log(`[GSHEET User] Fetching user data for login: "${login}"`);
    const response = await currentSheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: USER_DATA_RANGE,
    });
    const rows = response.data.values;
    if (!rows) {
      console.log(`[GSHEET User] No users found in sheet "${USERS_SHEET_NAME_ONLY}".`);
      return null;
    }
    const userRow = rows.find((row: any[]) => row[USER_COLUMN_MAP.login] === login);
    if (!userRow) {
      console.log(`[GSHEET User] User "${login}" not found.`);
      return null;
    }
    const userObject = rowToUser(userRow);
    console.log(`[GSHEET User] User data found for "${login}".`);
    return userObject;
  } catch (error: any) {
    console.error(`[GSHEET User] Error fetching user "${login}":`, error?.message || error);
    return null;
  }
};

export const verifyPassword = async (inputPassword: string, storedPasswordHash: string): Promise<boolean> => {
  console.log(`[GSHEET VerifyPassword] Verifying password for input length: ${inputPassword.length}, storedHash type: ${typeof storedPasswordHash}`);
  if (!storedPasswordHash || typeof storedPasswordHash !== 'string') {
    console.warn("[GSHEET VerifyPassword] Stored password hash is missing or not a string.");
    return false;
  }

  if (storedPasswordHash.startsWith(BCRYPT_PREFIX_1) || storedPasswordHash.startsWith(BCRYPT_PREFIX_2)) {
    console.log("[GSHEET VerifyPassword] Verifying bcrypt hash.");
    try {
      return await bcrypt.compare(inputPassword, storedPasswordHash);
    } catch (error) {
      console.error("[GSHEET VerifyPassword] Error comparing bcrypt hash:", error);
      return false;
    }
  }

  // Fallback to plain text comparison for non-bcrypt hashes
  console.warn("[Security] Comparing plain text password. User should update their password.");
  return inputPassword === storedPasswordHash;
};

const findUserRowIndexByLogin = async (login: string) => {
  return findRowIndexByColumnValue(
    USERS_SHEET_NAME_ONLY, 
    USER_COLUMN_MAP.login, 
    login, 
    USER_DATA_START_ROW
  );
};

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
    console.log(`[GSHEET User] Updating user: "${originalLogin}" with updates:`, JSON.stringify(Object.keys(updates))); 
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
    const updatedRow = [...currentUserDataRow];
    while (updatedRow.length < Object.keys(USER_COLUMN_MAP).length) {
      updatedRow.push('');
    }
    if (updates.login !== undefined && updates.login !== originalLogin) {
      const newLoginIndex = await findUserRowIndexByLogin(updates.login);
      if (newLoginIndex !== null && newLoginIndex !== rowIndex) { 
        console.warn(`[GSHEET User] Update conflict: New login "${updates.login}" already exists for another user.`);
        return false; 
      }
      updatedRow[USER_COLUMN_MAP.login] = updates.login;
    } else if (updates.login !== undefined) {
        updatedRow[USER_COLUMN_MAP.login] = updates.login;
    }
    if (updates.passwordHash !== undefined) {
      updatedRow[USER_COLUMN_MAP.passwordHash] = updates.passwordHash;
      console.log(`[GSHEET User] Storing new password hash for user ${originalLogin}: "${updates.passwordHash.substring(0,7)}..."`);
    }
    if (updates.firstName !== undefined) updatedRow[USER_COLUMN_MAP.firstName] = updates.firstName || '';
    if (updates.middleName !== undefined) updatedRow[USER_COLUMN_MAP.middleName] = updates.middleName || '';
    if (updates.lastName !== undefined) updatedRow[USER_COLUMN_MAP.lastName] = updates.lastName || '';
    if (updates.position !== undefined) updatedRow[USER_COLUMN_MAP.position] = updates.position || '';
    if (updates.iconColor !== undefined) updatedRow[USER_COLUMN_MAP.iconColor] = updates.iconColor || '';
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
  } catch (error: any) {
    console.error(`[GSHEET User] Error updating user "${originalLogin}":`, error?.message || error);
    return false;
  }
};

// --- Sales History Functions ---
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
  } catch (error: any) {
    console.error('[GSHEET History] Error fetching orders:', error?.message || error);
    throw new Error('Failed to fetch orders. Check permissions and config.');
  }
};

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
  } catch (error: any) {
    console.error(`[GSHEET History] Error adding order "${order.id}":`, error?.message || error);
    return false;
  }
};

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
  } catch (error: any) {
    console.error(`[GSHEET History] Error deleting order "${orderId}":`, error?.message || error);
    return false;
  }
};

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
    const response = await currentSheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${HISTORY_SHEET_NAME_ONLY}!A:A`, 
    });
    const rows = response.data.values;
    if (!rows || rows.length <= HISTORY_HEADER_ROW_COUNT) {
      console.log('[GSHEET History] No data rows to clear.');
      return true;
    }
    await currentSheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetGid,
              dimension: 'ROWS',
              startIndex: HISTORY_HEADER_ROW_COUNT, 
              endIndex: rows.length 
            }
          }
        }]
      }
    });
    console.log(`[GSHEET History] Successfully deleted all order rows from sheet "${HISTORY_SHEET_NAME_ONLY}".`);
    return true;
  } catch (error: any) {
    console.error(`[GSHEET History] Error clearing all orders:`, error?.message || error);
    return false;
  }
};

export const clearAllProductsFromSheet = async (): Promise<boolean> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) return false;
  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
    console.error('[GSHEET Product] Clear all operation requires Service Account credentials.');
    return false;
  }
  try {
    console.log(`[GSHEET Product] Clearing all products from sheet "${PRODUCT_SHEET_NAME_ONLY}".`);
    const sheetGid = await getSheetGid(PRODUCT_SHEET_NAME_ONLY);
    if (sheetGid === null) {
      console.error(`[GSHEET Product] Could not determine sheetId for "${PRODUCT_SHEET_NAME_ONLY}". Aborting clear operation.`);
      return false;
    }
    const response = await currentSheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${PRODUCT_SHEET_NAME_ONLY}!A:A`,
    });
    const rows = response.data.values;
    if (!rows || rows.length <= PRODUCT_HEADER_ROW_COUNT) {
      console.log('[GSHEET Product] No data rows to clear.');
      return true;
    }
    await currentSheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetGid,
              dimension: 'ROWS',
              startIndex: PRODUCT_HEADER_ROW_COUNT, 
              endIndex: rows.length 
            }
          }
        }]
      }
    });
    console.log(`[GSHEET Product] Successfully deleted all product rows from sheet "${PRODUCT_SHEET_NAME_ONLY}".`);
    return true;
  } catch (error: any) {
    console.error(`[GSHEET Product] Error clearing all products:`, error?.message || error);
    return false;
  }
};
