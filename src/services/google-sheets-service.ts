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
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const PRODUCT_SHEET_NAME_ONLY = process.env.GOOGLE_SHEET_NAME;
const USERS_SHEET_NAME_ONLY = process.env.GOOGLE_USERS_SHEET_NAME;

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let sheets: ReturnType<typeof google.sheets> | null = null;
let authError: string | null = null;

// Initialize Google Sheets client
const initializeSheetsClient = () => {
    try {
        if (!SHEET_ID || !PRODUCT_SHEET_NAME_ONLY || !USERS_SHEET_NAME_ONLY) {
            throw new Error("Missing Google Sheet configuration in environment variables (GOOGLE_SHEET_ID, GOOGLE_SHEET_NAME, GOOGLE_USERS_SHEET_NAME).");
        }

        let authClient: any;

        if (SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY) {
            console.log("[GSHEET Auth] Using Service Account credentials.");
            const auth = new GoogleAuth({
                credentials: {
                    client_email: SERVICE_ACCOUNT_EMAIL,
                    private_key: PRIVATE_KEY,
                },
                scopes: SCOPES,
            });
            authClient = auth;
        } else {
            throw new Error("Missing Google Sheets API credentials. Configure Service Account (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY).");
        }

        sheets = google.sheets({ version: 'v4', auth: authClient });
        console.log("[GSHEET Auth] Google Sheets client initialized successfully.");
        authError = null; // Reset auth error on successful init
    } catch (error: any) {
        console.error("!!! CRITICAL: Failed to initialize Google Sheets client:", error.message);
        authError = `Failed to initialize Google Sheets client: ${error.message}. Check environment variables and credentials.`;
        sheets = null; // Ensure sheets is null on failure
    }
};

// Call initialization immediately
initializeSheetsClient();

// Re-initialize if needed (e.g., for long-running server processes, though less common in serverless Next.js)
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


// Helper function to generate a somewhat stable local ID based on content + row index
const generateLocalId = (name: string, volume: string | undefined, rowIndex: number): string => {
  const hashString = `${name}-${volume || 'none'}-${rowIndex}`;
  let hash = 0;
  for (let i = 0; i < hashString.length; i++) {
    const char = hashString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `prod_${Math.abs(hash).toString(16)}_${rowIndex}`;
};

// Helper to convert sheet row to Product object, generating a local ID
const rowToProduct = (row: any[], arrayIndex: number): Product | null => {
  if (!row || row.length === 0 || !row[PRODUCT_COLUMN_MAP.name]) {
    return null;
  }
  const name = row[PRODUCT_COLUMN_MAP.name] ?? '';
  const volume = row[PRODUCT_COLUMN_MAP.volume] || undefined;
  const priceStr = row[PRODUCT_COLUMN_MAP.price]?.toString().replace(',', '.').trim();
  const isValidPrice = /^\d+(\.\d+)?$/.test(priceStr);
  const price = isValidPrice ? parseFloat(priceStr) : undefined;

  // Use array index + start row to calculate sheet row for ID generation
  const sheetRowIndex = arrayIndex + PRODUCT_DATA_START_ROW;
  const localId = generateLocalId(name, volume, sheetRowIndex);

  return {
    id: localId,
    name: name,
    volume: volume,
    price: price,
    imageUrl: row[PRODUCT_COLUMN_MAP.imageUrl] || undefined,
    dataAiHint: row[PRODUCT_COLUMN_MAP.dataAiHint] || undefined,
  };
};

// Helper to convert sheet row to User object
const rowToUser = (row: any[]): User | null => {
    if (!row || row.length <= USER_COLUMN_MAP.passwordHash || !row[USER_COLUMN_MAP.login]) {
        if(row.every(cell => cell === null || cell === '')) return null; // Skip truly empty rows
        console.warn(`[GSHEET User] Skipping row due to missing login or password column data:`, row);
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
        iconColor: isValidColor ? iconColorRaw : (iconColorRaw === '' ? undefined : iconColorRaw), // Handle empty string as undefined
    };
};

// Helper to convert Product object to sheet row (excluding local ID)
const productToRow = (product: Omit<Product, 'id'>): any[] => {
  const row: any[] = Array(Object.keys(PRODUCT_COLUMN_MAP).length).fill(''); // Initialize with correct length
  row[PRODUCT_COLUMN_MAP.name] = product.name;
  row[PRODUCT_COLUMN_MAP.volume] = product.volume ?? '';
  row[PRODUCT_COLUMN_MAP.price] = product.price !== undefined ? product.price : '';
  row[PRODUCT_COLUMN_MAP.imageUrl] = product.imageUrl ?? '';
  row[PRODUCT_COLUMN_MAP.dataAiHint] = product.dataAiHint ?? '';
  return row;
};

// Cache for sheet GIDs to avoid repeated lookups
let sheetGidCache: Record<string, number> = {};

// Helper function to get the sheetId (gid) for a given sheet name
const getSheetGid = async (sheetName: string): Promise<number | null> => {
    if (sheetGidCache[sheetName]) {
        return sheetGidCache[sheetName];
    }

    const currentSheets = getSheetsClient();
    if (!currentSheets) return null;

    try {
        const response = await currentSheets.spreadsheets.get({
            spreadsheetId: SHEET_ID!,
            fields: 'sheets(properties(sheetId,title))',
        });
        const sheetProperties = response.data.sheets?.find(
            (sheet) => sheet.properties?.title === sheetName
        )?.properties;

        if (sheetProperties?.sheetId !== undefined && sheetProperties?.sheetId !== null) {
            sheetGidCache[sheetName] = sheetProperties.sheetId;
            return sheetProperties.sheetId;
        } else {
            console.error(`[GSHEET] Could not find sheetId for sheet named "${sheetName}"`);
            return null;
        }
    } catch (error: any) {
        console.error(`[GSHEET] Error fetching sheetId for "${sheetName}":`, error?.message || error);
        return null;
    }
};

// Helper to find the row number of a product/user by a specific column value
const findRowIndexByColumnValue = async (
    sheetNameOnly: string,
    columnIndex: number,
    valueToFind: string,
    startRow: number
): Promise<number | null> => {
    const currentSheets = getSheetsClient();
    if (!currentSheets) return null;

    const columnLetter = String.fromCharCode('A'.charCodeAt(0) + columnIndex);
    const range = `${sheetNameOnly}!${columnLetter}${startRow}:${columnLetter}`;
    const logPrefix = sheetNameOnly === PRODUCT_SHEET_NAME_ONLY ? '[GSHEET Product]' : '[GSHEET User]';

    try {
        console.log(`${logPrefix} Searching for value "${valueToFind}" in column ${columnLetter} (${columnIndex}) starting from row ${startRow}`);
        const response = await currentSheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID!,
            range: range,
        });
        const rows = response.data.values;
        if (!rows) {
            console.log(`${logPrefix} No data rows found in column ${columnLetter}.`);
            return null;
        }

        const indexInData = rows.findIndex(row => row[0] === valueToFind);

        if (indexInData !== -1) {
            const sheetRowIndex = indexInData + startRow;
            console.log(`${logPrefix} Found match for "${valueToFind}" at sheet row index: ${sheetRowIndex}`);
            return sheetRowIndex;
        } else {
            console.log(`${logPrefix} Match not found for "${valueToFind}".`);
            return null;
        }
    } catch (error: any) {
        console.error(`${logPrefix} Error finding row index for value "${valueToFind}" in column ${columnLetter}:`, error?.message || error);
        return null;
    }
};


// Helper to find product row index considering both Name and Volume
const findProductRowIndexByNameAndVolume = async (name: string, volume?: string | null): Promise<number | null> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) return null;
  const searchVolume = volume ?? ''; // Treat null/undefined volume as empty string for matching

  try {
    console.log(`[GSHEET Product] Searching for Name: "${name}", Volume: "${searchVolume}" in range ${PRODUCT_SHEET_NAME_ONLY}!A${PRODUCT_DATA_START_ROW}:B`);
    const response = await currentSheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID!,
      range: `${PRODUCT_SHEET_NAME_ONLY}!A${PRODUCT_DATA_START_ROW}:B`,
    });
    const rows = response.data.values;
    if (!rows) {
        console.log("[GSHEET Product] No data rows found in Name/Volume columns.");
        return null;
    }

    const indexInData = rows.findIndex(row =>
        row[PRODUCT_COLUMN_MAP.name] === name &&
        (row[PRODUCT_COLUMN_MAP.volume] ?? '') === searchVolume
    );

    if (indexInData !== -1) {
        const sheetRowIndex = indexInData + PRODUCT_DATA_START_ROW;
        console.log(`[GSHEET Product] Found match for "${name}", "${searchVolume}" at sheet row index: ${sheetRowIndex}`);
        return sheetRowIndex;
    } else {
        console.log(`[GSHEET Product] Match not found for "${name}", "${searchVolume}".`);
        return null;
    }
  } catch (error: any) {
    console.error(`[GSHEET Product] Error finding row index for Name "${name}", Volume "${searchVolume}":`, error?.message || error);
    return null;
  }
};

// --- Public API ---

export const fetchProductsFromSheet = async (): Promise<Product[]> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) {
      throw new Error(`Google Sheets client not initialized. Auth error: ${authError}`);
  }

  try {
    console.log(`[GSHEET Product] Fetching products from range: ${PRODUCT_DATA_RANGE}`);
    const response = await currentSheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID!,
      range: PRODUCT_DATA_RANGE,
    });

    const rows = response.data.values;
    if (!rows) {
      console.log("[GSHEET Product] No data found in the sheet range.");
      return [];
    }

    console.log(`[GSHEET Product] Fetched ${rows.length} data rows.`);
    const products = rows
      .map((row, index) => rowToProduct(row, index))
      .filter((product): product is Product => product !== null);

    console.log(`[GSHEET Product] Successfully parsed ${products.length} products.`);
    return products;
  } catch (error: any) {
    console.error('[GSHEET Product] Error fetching products from Google Sheet:', error?.message || error);
    throw new Error('Failed to fetch products from Google Sheet. Check permissions and config.');
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
    console.log(`[GSHEET Product] Attempting to add product: Name "${product.name}", Volume "${product.volume || ''}"`);
    const existingRowIndex = await findProductRowIndexByNameAndVolume(product.name, product.volume);
    if (existingRowIndex !== null) {
        console.warn(`[GSHEET Product] Product "${product.name}" (${product.volume || 'N/A'}) already exists at row ${existingRowIndex}. Skipping add.`);
        return false; // Indicate existing
    }

    const row = productToRow(product);
    await currentSheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID!,
      range: PRODUCT_FULL_RANGE_FOR_APPEND,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });
    console.log(`[GSHEET Product] Successfully added product: Name "${product.name}", Volume "${product.volume || ''}"`);
    return true;
  } catch (error: any) {
    console.error(`[GSHEET Product] Error adding product "${product.name}" to Google Sheet:`, error?.message || error);
    console.error("[GSHEET Product] Check Service Account permissions and Sheet sharing settings.");
    return false;
  }
};

export const updateProductInSheet = async (
    payload: {
        originalName: string;
        originalVolume?: string | null;
        newData: Omit<Product, 'id'>;
    }
): Promise<boolean> => {
  const { originalName, originalVolume, newData } = payload;
  const currentSheets = getSheetsClient();
  if (!currentSheets) return false;

  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
      console.error('[GSHEET Product] Update operation requires Service Account credentials.');
      return false;
  }
  if (!originalName || !newData.name) {
    console.error('[GSHEET Product] Original or new product name missing for update.');
    return false;
  }

  try {
    console.log(`[GSHEET Product] Attempting to update product originally named: "${originalName}", Volume: "${originalVolume || ''}"`);
    console.log(`[GSHEET Product] New data: Name "${newData.name}", Volume "${newData.volume || ''}", Price: ${newData.price}`);

    const rowIndex = await findProductRowIndexByNameAndVolume(originalName, originalVolume);
    if (rowIndex === null) {
      console.error(`[GSHEET Product] Product with original Name "${originalName}", Volume "${originalVolume || ''}" not found for update.`);
      return false;
    }

    // Check for conflicts only if Name or Volume changes
    if (newData.name !== originalName || (newData.volume ?? '') !== (originalVolume ?? '')) {
        const potentialConflictIndex = await findProductRowIndexByNameAndVolume(newData.name, newData.volume);
        if (potentialConflictIndex !== null && potentialConflictIndex !== rowIndex) {
            console.warn(`[GSHEET Product] Update conflict: Another product with Name "${newData.name}" and Volume "${newData.volume || ''}" already exists at row ${potentialConflictIndex}. Aborting update.`);
            return false;
        }
    }

    const range = `${PRODUCT_SHEET_NAME_ONLY}!A${rowIndex}:E${rowIndex}`;
    const rowData = productToRow(newData);

    console.log(`[GSHEET Product] Updating row ${rowIndex} with data:`, rowData);
    await currentSheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID!,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });
    console.log(`[GSHEET Product] Successfully updated product at row ${rowIndex}`);
    return true;
  } catch (error: any) {
    console.error(`[GSHEET Product] Error updating product originally named "${originalName}" in Google Sheet:`, error?.message || error);
    console.error("[GSHEET Product] Check Service Account permissions and Sheet sharing settings.");
    return false;
  }
};

export const deleteProductFromSheet = async (productIdentifier: { name: string, volume?: string | null }): Promise<boolean> => {
    const currentSheets = getSheetsClient();
    if (!currentSheets) return false;

    if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
      console.error('[GSHEET Product] Delete operation requires Service Account credentials.');
      return false;
    }
    const { name, volume } = productIdentifier;
    if (!name) {
        console.error('[GSHEET Product] Attempted to delete product without a name.');
        return false;
    }

    try {
        console.log(`[GSHEET Product] Attempting to delete product: Name "${name}", Volume "${volume || ''}"`);
        const rowIndex = await findProductRowIndexByNameAndVolume(name, volume);
        if (rowIndex === null) {
            console.error(`[GSHEET Product] Product with Name "${name}", Volume "${volume || ''}" not found for deletion.`);
            return false;
        }

        const sheetGid = await getSheetGid(PRODUCT_SHEET_NAME_ONLY!);
        if (sheetGid === null) {
            console.error(`[GSHEET Product] Could not determine sheetId for sheet name "${PRODUCT_SHEET_NAME_ONLY}". Aborting delete.`);
            return false;
        }
        console.log(`[GSHEET Product] Using sheetId (gid): ${sheetGid} for deletion request.`);

        console.log(`[GSHEET Product] Requesting deletion of row index: ${rowIndex} (0-based: ${rowIndex - 1})`);
        await currentSheets.spreadsheets.batchUpdate({
            spreadsheetId: SHEET_ID!,
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
        console.log(`[GSHEET Product] Successfully deleted product: Name "${name}", Volume "${volume || ''}" (row ${rowIndex})`);
        return true;
    } catch (error: any) {
        console.error(`[GSHEET Product] Error deleting product "${name}" from Google Sheet:`, error?.message || error);
        console.error("[GSHEET Product] Check Service Account permissions and Sheet sharing settings.");
        if ((error as any)?.message?.includes('Invalid requests[0].deleteDimension.range.sheetId')) {
            console.warn("[GSHEET Product] Potential sheetId mismatch. The gid used might be incorrect.");
        }
        return false;
    }
};

export const syncRawProductsToSheet = async (): Promise<{ success: boolean; message: string; addedCount: number; skippedCount: number }> => {
  const currentSheets = getSheetsClient();
  if (!currentSheets) {
    return { success: false, message: `Google Sheets client not initialized. Auth error: ${authError}`, addedCount: 0, skippedCount: 0 };
  }
  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
       return { success: false, message: "Sync operation requires Service Account credentials.", addedCount: 0, skippedCount: 0 };
  }

  console.log("[GSHEET Product] Starting syncRawProductsToSheet...");

  try {
    const rawProducts = getRawProductData();
    console.log(`[GSHEET Product] Found ${rawProducts.length} raw products defined.`);

    const existingProducts = await fetchProductsFromSheet(); // Re-fetch inside try-catch
    const existingProductKeys = new Set(existingProducts.map(p => `${p.name}|${p.volume ?? ''}`));
    console.log(`[GSHEET Product] Found ${existingProductKeys.size} unique existing product combinations in the sheet.`);

    const productsToAdd = rawProducts.filter(rp => !existingProductKeys.has(`${rp.name}|${rp.volume ?? ''}`));
    const skippedCount = rawProducts.length - productsToAdd.length;

    console.log(`[GSHEET Product] Products to add: ${productsToAdd.length}, Products skipped: ${skippedCount}`);

    if (productsToAdd.length === 0) {
      console.log("[GSHEET Product] No new products to add.");
      return { success: true, message: "All example products are already in the sheet.", addedCount: 0, skippedCount: skippedCount };
    }

    const rowsToAdd = productsToAdd.map(productToRow);
    console.log(`[GSHEET Product] Attempting to append ${rowsToAdd.length} rows.`);

    const appendResult = await currentSheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID!,
      range: PRODUCT_FULL_RANGE_FOR_APPEND,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: rowsToAdd,
      },
    });

    console.log("[GSHEET Product] Append operation successful:", JSON.stringify(appendResult.data, null, 2));
    return { success: true, message: `Successfully added ${productsToAdd.length} example products.`, addedCount: productsToAdd.length, skippedCount: skippedCount };

  } catch (error: any) {
    console.error('[GSHEET Product] Error syncing raw products to Google Sheet:', error?.message || error);
    console.error("[GSHEET Product] Check Service Account permissions and Sheet sharing settings.");
    let message = `Failed to sync example products. ${error?.message || 'Unknown error'}`;
    return { success: false, message: message, addedCount: 0, skippedCount: 0 }; // Assume 0 added if error occurs during sync
  }
};

// --- User Authentication Functions ---

export const getUserDataFromSheet = async (login: string): Promise<User | null> => {
    const currentSheets = getSheetsClient();
    if (!currentSheets) return null;

    try {
        console.log(`[GSHEET User] Fetching user data for login: ${login}`);
        const response = await currentSheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID!,
            range: USER_DATA_RANGE,
        });

        const rows = response.data.values;
        if (!rows) {
            console.log(`[GSHEET User] No users found in sheet ${USERS_SHEET_NAME_ONLY}.`);
            return null;
        }
        console.log(`[GSHEET User] Fetched ${rows.length} user rows.`);

        const userRow = rows.find(row => row[USER_COLUMN_MAP.login] === login);

        if (!userRow) {
            console.log(`[GSHEET User] User with login "${login}" not found.`);
            return null;
        }

        console.log(`[GSHEET User] Found row data for login "${login}"`); // Don't log entire row for security
        const user = rowToUser(userRow);

        if (user) {
             console.log(`[GSHEET User] Successfully parsed user data for login "${login}"`);
        } else {
             console.warn(`[GSHEET User] Failed to parse user data for login "${login}"`);
        }

        return user;

    } catch (error: any) {
        console.error(`[GSHEET User] Error fetching user data for login "${login}":`, error?.message || error);
        return null;
    }
};

export const verifyPassword = async (inputPassword: string, storedHash: string): Promise<boolean> => {
    // !! IMPORTANT: Placeholder - Replace with actual hashing comparison !!
    // import bcrypt from 'bcryptjs';
    // return bcrypt.compareSync(inputPassword, storedHash);
    console.warn("[Security] Comparing passwords in plain text. Replace with hashing!");
    return inputPassword === storedHash;
};

// Helper to find user row index by Login
const findUserRowIndexByLogin = async (login: string): Promise<number | null> => {
    return findRowIndexByColumnValue(USERS_SHEET_NAME_ONLY!, USER_COLUMN_MAP.login, login, USER_DATA_START_ROW);
};

export const updateUserInSheet = async (originalLogin: string, updates: Partial<User>): Promise<boolean> => {
    const currentSheets = getSheetsClient();
    if (!currentSheets) return false;

    if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
        console.error('[GSHEET User] Update operation requires Service Account credentials.');
        return false;
    }
    if (!originalLogin) {
        console.error('[GSHEET User] Original login missing for update operation.');
        return false;
    }

    try {
        console.log(`[GSHEET User] Attempting to update user originally named: "${originalLogin}"`);
        const rowIndex = await findUserRowIndexByLogin(originalLogin);
        if (rowIndex === null) {
            console.error(`[GSHEET User] User with original login "${originalLogin}" not found for update.`);
            return false;
        }

        const userRowRange = `${USERS_SHEET_NAME_ONLY}!A${rowIndex}:H${rowIndex}`;
        // Fetch the current row data to merge updates
        const currentUserDataRowResponse = await currentSheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID!,
            range: userRowRange,
        });
        const currentUserDataRow = currentUserDataRowResponse.data.values?.[0];

        if (!currentUserDataRow) {
             console.error(`[GSHEET User] Could not fetch current data for user "${originalLogin}" at row ${rowIndex}.`);
             return false;
        }

        // Create a new row array and populate with existing data
        const updatedRow: any[] = Array(Object.keys(USER_COLUMN_MAP).length).fill(null);
        currentUserDataRow.forEach((value, index) => {
            if (index < updatedRow.length) updatedRow[index] = value ?? ''; // Default to empty string if cell is truly empty or null
        });


        // Apply updates
        if (updates.login !== undefined) updatedRow[USER_COLUMN_MAP.login] = updates.login;
        if (updates.passwordHash !== undefined) updatedRow[USER_COLUMN_MAP.passwordHash] = updates.passwordHash;
        if (updates.firstName !== undefined) updatedRow[USER_COLUMN_MAP.firstName] = updates.firstName || '';
        if (updates.middleName !== undefined) updatedRow[USER_COLUMN_MAP.middleName] = updates.middleName || '';
        if (updates.lastName !== undefined) updatedRow[USER_COLUMN_MAP.lastName] = updates.lastName || '';
        if (updates.position !== undefined) updatedRow[USER_COLUMN_MAP.position] = updates.position || '';
        if (updates.iconColor !== undefined) updatedRow[USER_COLUMN_MAP.iconColor] = updates.iconColor || '';


        // If login is being changed, ensure the new login isn't already taken by another user
        if (updates.login && updates.login !== originalLogin) {
            const newLoginIndex = await findUserRowIndexByLogin(updates.login);
            if (newLoginIndex !== null && newLoginIndex !== rowIndex) {
                console.warn(`[GSHEET User] Update conflict: New login "${updates.login}" already exists for another user at row ${newLoginIndex}. Aborting update.`);
                return false;
            }
        }


        console.log(`[GSHEET User] Updating row ${rowIndex} for user originally "${originalLogin}", new login (if changed) "${updates.login || originalLogin}"`);
        await currentSheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID!,
            range: userRowRange,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [updatedRow],
            },
        });

        console.log(`[GSHEET User] Successfully updated user at row ${rowIndex}`);
        return true;
    } catch (error: any) {
        console.error(`[GSHEET User] Error updating user "${originalLogin}" in Google Sheet:`, error?.message || error);
        console.error("[GSHEET User] Check Service Account permissions and Sheet sharing settings.");
        return false;
    }
};

// Placeholder for password hashing - IMPLEMENT SECURELY
// import bcrypt from 'bcryptjs';
// export const hashPassword = async (password: string): Promise<string> => {
//   console.warn("[Security] Hashing password with bcrypt. Ensure bcryptjs is installed.");
//   const salt = await bcrypt.genSalt(10);
//   return bcrypt.hash(password, salt);
// };
