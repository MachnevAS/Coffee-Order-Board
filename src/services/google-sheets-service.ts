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
// IMPORTANT: Ensure the private key is stored correctly in the environment variable,
// especially handling newline characters (e.g., replace \n with \\n).
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
// Sheet name MUST be just the name (e.g., 'price'), range is defined separately
const PRODUCT_SHEET_NAME_ONLY = process.env.GOOGLE_SHEET_NAME;
const USERS_SHEET_NAME_ONLY = process.env.GOOGLE_USERS_SHEET_NAME;

// --- API Key (Optional for Read-Only Fallback/Alternative) ---
// const API_KEY = process.env.GOOGLE_SHEETS_API_KEY; // Can still be used for read operations if preferred

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let sheets: ReturnType<typeof google.sheets> | null = null;
let authError: string | null = null;

try {
    if (!SHEET_ID || !PRODUCT_SHEET_NAME_ONLY || !USERS_SHEET_NAME_ONLY) {
        throw new Error("Missing Google Sheet configuration in environment variables (GOOGLE_SHEET_ID, GOOGLE_SHEET_NAME, GOOGLE_USERS_SHEET_NAME).");
    }

    let authClient: any; // Can be GoogleAuth JWT client or API key

    // Prioritize Service Account for write operations
    if (SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY) {
        console.log("[GSHEET Auth] Using Service Account credentials.");
        const auth = new GoogleAuth({
            credentials: {
                client_email: SERVICE_ACCOUNT_EMAIL,
                private_key: PRIVATE_KEY,
            },
            scopes: SCOPES,
        });
        authClient = auth; // googleapis library can directly use the GoogleAuth instance
    }
    // Fallback to API Key for read operations if Service Account is not configured
    /*
    else if (API_KEY) {
        console.warn("[GSHEET Auth] Using API Key credentials (read-only operations recommended).");
        authClient = API_KEY;
        // Note: Write operations (add, update, delete) will fail with only API key
    }
    */
    else {
        // Throw error if neither Service Account nor API Key (if it were enabled) is provided
        throw new Error("Missing Google Sheets API credentials. Configure Service Account (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY).");
    }


    sheets = google.sheets({ version: 'v4', auth: authClient });
    console.log("[GSHEET Auth] Google Sheets client initialized successfully.");

} catch (error: any) {
    console.error("!!! CRITICAL: Failed to initialize Google Sheets client:", error.message);
    authError = `Failed to initialize Google Sheets client: ${error.message}. Check environment variables and credentials.`;
    // Keep 'sheets' as null to indicate initialization failure
}


// Column mapping for products sheet
const PRODUCT_COLUMN_MAP = {
  name: 0,     // Column A
  volume: 1,   // Column B
  price: 2,    // Column C
  imageUrl: 3, // Column D
  dataAiHint: 4 // Column E
};
const PRODUCT_HEADER_ROW_COUNT = 1;
const PRODUCT_DATA_RANGE = `${PRODUCT_SHEET_NAME_ONLY}!A${PRODUCT_HEADER_ROW_COUNT + 1}:E`; // Read data starting after header
const PRODUCT_FULL_RANGE_FOR_APPEND = `${PRODUCT_SHEET_NAME_ONLY}!A:E`; // Append to columns A-E

// Column mapping for users sheet
const USER_COLUMN_MAP = {
    id: 0, // Column A
    login: 1, // Column B
    passwordHash: 2, // Column C (Assuming password or hash is here)
    firstName: 3, // Column D
    middleName: 4, // Column E
    lastName: 5, // Column F
    position: 6, // Column G
    iconColor: 7 // Column H
};
const USER_HEADER_ROW_COUNT = 1;
// Fetch all columns A-H for users, starting from the row after the header
const USER_DATA_RANGE = `${USERS_SHEET_NAME_ONLY}!A${USER_HEADER_ROW_COUNT + 1}:H`;


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
const rowToProduct = (row: any[], rowIndex: number): Product | null => {
  if (!row || row.length === 0 || !row[PRODUCT_COLUMN_MAP.name]) {
    return null; // Skip empty rows or rows without a name
  }
  const name = row[PRODUCT_COLUMN_MAP.name] ?? '';
  const volume = row[PRODUCT_COLUMN_MAP.volume] || undefined;
  const priceStr = row[PRODUCT_COLUMN_MAP.price]?.toString().replace(',', '.').trim(); // Handle comma decimal, trim whitespace

  // Validate price: allow only numbers (integers or decimals)
  const isValidPrice = /^\d+(\.\d+)?$/.test(priceStr);
  const price = isValidPrice ? parseFloat(priceStr) : undefined;


  // Generate a local ID based on row content and index
  // Add header offset + 1 because sheet rows are 1-based, array index is 0-based
  const localId = generateLocalId(name, volume, rowIndex + PRODUCT_HEADER_ROW_COUNT + 1);

  return {
    id: localId, // Generated local ID
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
        // Check if it's just an empty row
        if(row.every(cell => cell === '')) return null;
        console.warn(`[GSHEET User] Skipping row due to missing login or password column data:`, row);
        return null; // Skip rows missing critical data
    }
    // Basic validation for iconColor (should be HEX)
    const iconColorRaw = row[USER_COLUMN_MAP.iconColor];
    const isValidColor = typeof iconColorRaw === 'string' && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(iconColorRaw);

    return {
        id: row[USER_COLUMN_MAP.id] ?? '', // Assuming ID is in the first column
        login: row[USER_COLUMN_MAP.login],
        passwordHash: row[USER_COLUMN_MAP.passwordHash], // Store the hash/password directly
        firstName: row[USER_COLUMN_MAP.firstName] || undefined,
        middleName: row[USER_COLUMN_MAP.middleName] || undefined,
        lastName: row[USER_COLUMN_MAP.lastName] || undefined,
        position: row[USER_COLUMN_MAP.position] || undefined,
        iconColor: isValidColor ? iconColorRaw : undefined, // Use undefined if invalid format
    };
};


// Helper to convert Product object to sheet row (excluding local ID)
const productToRow = (product: Omit<Product, 'id'>): any[] => {
  const row: any[] = [];
  row[PRODUCT_COLUMN_MAP.name] = product.name;
  row[PRODUCT_COLUMN_MAP.volume] = product.volume ?? ''; // Use empty string for undefined
  // Store price as a number if defined, otherwise empty string
  row[PRODUCT_COLUMN_MAP.price] = product.price !== undefined ? product.price : '';
  row[PRODUCT_COLUMN_MAP.imageUrl] = product.imageUrl ?? '';
  row[PRODUCT_COLUMN_MAP.dataAiHint] = product.dataAiHint ?? '';
  // Ensure the row has the correct number of columns (A-E)
  while(row.length < 5) row.push('');
  return row;
};

// Helper function to get the sheetId (gid) for a given sheet name
const getSheetGid = async (sheetName: string): Promise<number | null> => {
    if (!sheets || authError) {
      console.error(`[GSHEET] Sheets client not initialized in getSheetGid. Auth error: ${authError}`);
      return null;
    }
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SHEET_ID!, // Non-null assertion as checked in initialization
            fields: 'sheets(properties(sheetId,title))',
        });
        const sheetProperties = response.data.sheets?.find(
            (sheet) => sheet.properties?.title === sheetName
        )?.properties;

        if (sheetProperties?.sheetId !== undefined && sheetProperties?.sheetId !== null) {
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

// Helper to find the row number of a product by Name and Volume
const findProductRowIndexByNameAndVolume = async (name: string, volume?: string | null): Promise<number | null> => {
  if (!sheets || authError) {
    console.error(`[GSHEET Product] Sheets client not initialized in findProductRowIndexByNameAndVolume. Auth error: ${authError}`);
    return null;
  }
  const searchVolume = volume ?? ''; // Treat null/undefined volume as empty string for matching

  try {
    console.log(`[GSHEET Product] Searching for Name: "${name}", Volume: "${searchVolume}" in range ${PRODUCT_SHEET_NAME_ONLY}!A:B`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID!,
      // Fetch Name and Volume columns starting after the header row
      range: `${PRODUCT_SHEET_NAME_ONLY}!A${PRODUCT_HEADER_ROW_COUNT + 1}:B`,
    });
    const rows = response.data.values;
    if (!rows) {
        console.log("[GSHEET Product] No data rows found in Name/Volume columns.");
        return null;
    }

    // Find the index in the fetched data (0-based relative to data start)
    const indexInData = rows.findIndex(row =>
        row[PRODUCT_COLUMN_MAP.name] === name && // Match name
        (row[PRODUCT_COLUMN_MAP.volume] ?? '') === searchVolume // Match volume (treat null/undefined/empty as '')
    );

    if (indexInData !== -1) {
        // Calculate the actual sheet row index (1-based)
        const sheetRowIndex = indexInData + PRODUCT_HEADER_ROW_COUNT + 1;
        console.log(`[GSHEET Product] Found match for "${name}", "${searchVolume}" at sheet row index: ${sheetRowIndex}`);
        return sheetRowIndex;
    } else {
        console.log(`[GSHEET Product] Match not found for "${name}", "${searchVolume}".`);
        return null;
    }
  } catch (error: any) {
    console.error(`[GSHEET Product] Error finding row index for Name "${name}", Volume "${searchVolume}":`, error?.message || error);
    // console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    return null;
  }
};

// Fetch products and generate local IDs
export const fetchProductsFromSheet = async (): Promise<Product[]> => {
  if (!sheets || authError) {
    console.error(`[GSHEET Product] Sheets client not initialized in fetchProductsFromSheet. Auth error: ${authError}`);
    return [];
  }
  try {
    console.log(`[GSHEET Product] Fetching products from range: ${PRODUCT_DATA_RANGE}`);
    const response = await sheets.spreadsheets.values.get({
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
    // console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    throw new Error('Failed to fetch products from Google Sheet. Check Service Account/API Key permissions and Sheet ID/Permissions.');
  }
};

// Add a product (row without ID) - Requires Service Account Auth
export const addProductToSheet = async (product: Omit<Product, 'id'>): Promise<boolean> => {
   if (!sheets || authError) {
       console.error(`[GSHEET Product] Sheets client not initialized in addProductToSheet. Auth error: ${authError}`);
       return false;
   }
   if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
       console.error('[GSHEET Product] Add operation requires Service Account credentials. API Key is not sufficient.');
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
        return false; // Indicate that the product was not added because it exists
    }

    const row = productToRow(product);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID!,
      range: PRODUCT_FULL_RANGE_FOR_APPEND,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS', // Explicitly insert rows
      requestBody: {
        values: [row],
      },
    });
    console.log(`[GSHEET Product] Successfully added product: Name "${product.name}", Volume "${product.volume || ''}"`);
    return true;
  } catch (error: any) {
    console.error(`[GSHEET Product] Error adding product "${product.name}" to Google Sheet:`, error?.message || error);
    // console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    console.error("[GSHEET Product] Check Service Account permissions (must allow writing) and Sheet sharing settings.");
    return false;
  }
};

// Update a product, finding it by ORIGINAL Name and Volume - Requires Service Account Auth
export const updateProductInSheet = async (
    payload: {
        originalName: string;
        originalVolume?: string | null;
        newData: Omit<Product, 'id'>;
    }
): Promise<boolean> => {
  const { originalName, originalVolume, newData } = payload;

  if (!sheets || authError) {
    console.error(`[GSHEET Product] Sheets client not initialized in updateProductInSheet. Auth error: ${authError}`);
    return false;
  }
  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
      console.error('[GSHEET Product] Update operation requires Service Account credentials. API Key is not sufficient.');
      return false;
  }
  if (!originalName) {
    console.error('[GSHEET Product] Original product name missing for update.');
    return false;
  }
   if (!newData.name) {
       console.error('[GSHEET Product] New product name missing for update.');
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

    // Check if the new Name+Volume combination already exists elsewhere (excluding the current row)
    const potentialConflictIndex = await findProductRowIndexByNameAndVolume(newData.name, newData.volume);
    if (potentialConflictIndex !== null && potentialConflictIndex !== rowIndex) {
        console.warn(`[GSHEET Product] Update conflict: Another product with Name "${newData.name}" and Volume "${newData.volume || ''}" already exists at row ${potentialConflictIndex}. Aborting update.`);
        return false; // Or handle as an error, depending on desired behavior
    }


    const range = `${PRODUCT_SHEET_NAME_ONLY}!A${rowIndex}:E${rowIndex}`;
    const rowData = productToRow(newData);

    console.log(`[GSHEET Product] Updating row ${rowIndex} with data:`, rowData);
    await sheets.spreadsheets.values.update({
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
    // console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    console.error("[GSHEET Product] Check Service Account permissions (must allow writing) and Sheet sharing settings.");
    return false;
  }
};

// Delete a product, finding it by Name and Volume - Requires Service Account Auth
export const deleteProductFromSheet = async (productIdentifier: { name: string, volume?: string | null }): Promise<boolean> => {
  if (!sheets || authError) {
    console.error(`[GSHEET Product] Sheets client not initialized in deleteProductFromSheet. Auth error: ${authError}`);
    return false;
  }
  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
      console.error('[GSHEET Product] Delete operation requires Service Account credentials. API Key is not sufficient.');
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
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID!,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetGid,
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // 0-based index for API
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });
    console.log(`[GSHEET Product] Successfully deleted product: Name "${name}", Volume "${volume || ''}" (row ${rowIndex})`);
    return true;
  } catch (error: any) {
    console.error(`[GSHEET Product] Error deleting product "${name}" from Google Sheet:`, error?.message || error);
    // console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    console.error("[GSHEET Product] Check Service Account permissions (must allow writing) and Sheet sharing settings.");
    if ((error as any)?.message?.includes('Invalid requests[0].deleteDimension.range.sheetId')) {
         console.warn("[GSHEET Product] Potential sheetId mismatch. The gid used might be incorrect. Verify the getSheetGid function or hardcode if necessary.");
    }
    return false;
  }
};

// Function to add the raw products (defined in product-defaults) to the Google Sheet - Requires Service Account Auth
export const syncRawProductsToSheet = async (): Promise<{ success: boolean; message: string; addedCount: number; skippedCount: number }> => {
  if (!sheets || authError) {
    return { success: false, message: `Google Sheets client not initialized. Auth error: ${authError}`, addedCount: 0, skippedCount: 0 };
  }
   if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
       return { success: false, message: "Sync operation requires Service Account credentials. API Key is not sufficient.", addedCount: 0, skippedCount: 0 };
   }

  console.log("[GSHEET Product] Starting syncRawProductsToSheet...");

  try {
    const rawProducts = getRawProductData();
    console.log(`[GSHEET Product] Found ${rawProducts.length} raw products defined.`);

    const existingProducts = await fetchProductsFromSheet(); // Fetch can use API key or SA
    const existingProductKeys = new Set(existingProducts.map(p => `${p.name}|${p.volume ?? ''}`));
    console.log(`[GSHEET Product] Found ${existingProductKeys.size} unique existing product combinations (Name|Volume) in the sheet.`);

    const productsToAdd = rawProducts.filter(rp => {
        const key = `${rp.name}|${rp.volume ?? ''}`;
        return !existingProductKeys.has(key);
    });
    const skippedCount = rawProducts.length - productsToAdd.length;

    console.log(`[GSHEET Product] Products to add: ${productsToAdd.length}, Products skipped: ${skippedCount}`);

    if (productsToAdd.length === 0) {
      console.log("[GSHEET Product] No new products to add.");
      return { success: true, message: "All example products are already in the sheet.", addedCount: 0, skippedCount: skippedCount };
    }

    const rowsToAdd = productsToAdd.map(productToRow);
    console.log(`[GSHEET Product] Attempting to append ${rowsToAdd.length} rows.`);

    const appendResult = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID!,
      range: PRODUCT_FULL_RANGE_FOR_APPEND,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS', // Ensure new rows are inserted
      requestBody: {
        values: rowsToAdd,
      },
    });

    console.log("[GSHEET Product] Append operation successful:", JSON.stringify(appendResult.data, null, 2));
    return { success: true, message: `Successfully added ${productsToAdd.length} example products to the sheet.`, addedCount: productsToAdd.length, skippedCount: skippedCount };

  } catch (error: any) {
    console.error('[GSHEET Product] Error syncing raw products to Google Sheet:', error?.message || error);
    // console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    console.error("[GSHEET Product] Check Service Account permissions (must allow writing) and Sheet sharing settings.");
    let message = 'Failed to sync example products to Google Sheet.';
    if (error?.errors?.length > 0) {
        message += ` Error detail: ${error.errors[0].message}`;
    } else if (error?.message) {
        message += ` Error detail: ${error.message}`;
    }
    return { success: false, message: message, addedCount: 0, skippedCount: skippedCount };
  }
};

// --- User Authentication Functions ---

// Fetch user data by login
export const getUserDataFromSheet = async (login: string): Promise<User | null> => {
    if (!sheets || authError) {
        console.error(`[GSHEET User] Sheets client not initialized in getUserDataFromSheet. Auth error: ${authError}`);
        return null;
    }
    try {
        console.log(`[GSHEET User] Fetching user data for login: ${login}`);
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID!,
            range: USER_DATA_RANGE, // Use the correct range defined earlier
        });

        const rows = response.data.values;
        if (!rows) {
            console.log(`[GSHEET User] No users found in sheet ${USERS_SHEET_NAME_ONLY}.`);
            return null;
        }
        console.log(`[GSHEET User] Fetched ${rows.length} user rows.`);

        // Find the row matching the login
        const userRow = rows.find(row => row[USER_COLUMN_MAP.login] === login);

        if (!userRow) {
            console.log(`[GSHEET User] User with login "${login}" not found.`);
            return null;
        }

        console.log(`[GSHEET User] Found row data for login "${login}":`, userRow);
        const user = rowToUser(userRow);

        if (user) {
             console.log(`[GSHEET User] Successfully parsed user data for login "${login}":`, user);
        } else {
             console.warn(`[GSHEET User] Failed to parse user data for row:`, userRow);
        }

        return user;

    } catch (error: any) {
        console.error(`[GSHEET User] Error fetching user data for login "${login}":`, error?.message || error);
        // Consider specific error handling, e.g., permission denied
        return null;
    }
};

// Verify password (replace with actual hashing comparison)
export const verifyPassword = async (inputPassword: string, storedHash: string): Promise<boolean> => {
    // !! IMPORTANT !!
    // This is a placeholder. Replace with actual password hashing and verification.
    // Example using bcrypt (you'd need to install bcryptjs: `npm install bcryptjs @types/bcryptjs`)
    // import bcrypt from 'bcryptjs';
    // return bcrypt.compareSync(inputPassword, storedHash);
    console.warn("[Security] Comparing passwords in plain text. Replace with hashing!");
    return inputPassword === storedHash;
};


// Helper to find the row number of a user by Login
const findUserRowIndexByLogin = async (login: string): Promise<number | null> => {
  if (!sheets || authError) {
    console.error(`[GSHEET User] Sheets client not initialized in findUserRowIndexByLogin. Auth error: ${authError}`);
    return null;
  }

  try {
    console.log(`[GSHEET User] Searching for Login: "${login}" in range ${USERS_SHEET_NAME_ONLY}!B:B`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID!,
      // Fetch only the Login column starting after the header
      range: `${USERS_SHEET_NAME_ONLY}!B${USER_HEADER_ROW_COUNT + 1}:B`,
    });
    const rows = response.data.values;
    if (!rows) {
        console.log("[GSHEET User] No data rows found in Login column.");
        return null;
    }

    const indexInData = rows.findIndex(row => row[0] === login); // Index 0 because we only fetched one column

    if (indexInData !== -1) {
        // Calculate the actual sheet row index (1-based)
        const sheetRowIndex = indexInData + USER_HEADER_ROW_COUNT + 1;
        console.log(`[GSHEET User] Found match for login "${login}" at sheet row index: ${sheetRowIndex}`);
        return sheetRowIndex;
    } else {
        console.log(`[GSHEET User] Match not found for login "${login}".`);
        return null;
    }
  } catch (error: any) {
    console.error(`[GSHEET User] Error finding row index for login "${login}":`, error?.message || error);
    return null;
  }
};


// Update user data in the sheet - Requires Service Account Auth
export const updateUserInSheet = async (login: string, updates: Partial<User>): Promise<boolean> => {
    if (!sheets || authError) {
        console.error(`[GSHEET User] Sheets client not initialized in updateUserInSheet. Auth error: ${authError}`);
        return false;
    }
    if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
        console.error('[GSHEET User] Update operation requires Service Account credentials.');
        return false;
    }
    if (!login) {
        console.error('[GSHEET User] Login missing for update operation.');
        return false;
    }

    try {
        console.log(`[GSHEET User] Attempting to update user: "${login}"`);
        const rowIndex = await findUserRowIndexByLogin(login);
        if (rowIndex === null) {
            console.error(`[GSHEET User] User with login "${login}" not found for update.`);
            return false;
        }

        // Fetch the current user data to merge updates
        const currentUserDataRow = (await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID!,
            range: `${USERS_SHEET_NAME_ONLY}!A${rowIndex}:H${rowIndex}`, // Fetch the entire row
        })).data.values?.[0];

        if (!currentUserDataRow) {
             console.error(`[GSHEET User] Could not fetch current data for user "${login}" at row ${rowIndex}.`);
             return false;
        }

        // Prepare the updated row data, ensuring all columns A-H are present
        const updatedRow: any[] = [];
        for (let i = 0; i < 8; i++) { // Ensure 8 columns (A-H)
           updatedRow[i] = currentUserDataRow[i] ?? ''; // Default to empty string if column was empty
        }

        // Apply updates to allowed fields
        if (updates.firstName !== undefined) updatedRow[USER_COLUMN_MAP.firstName] = updates.firstName || '';
        if (updates.middleName !== undefined) updatedRow[USER_COLUMN_MAP.middleName] = updates.middleName || '';
        if (updates.lastName !== undefined) updatedRow[USER_COLUMN_MAP.lastName] = updates.lastName || '';
        // Add password update logic here if implemented
        // if (updates.passwordHash !== undefined) updatedRow[USER_COLUMN_MAP.passwordHash] = updates.passwordHash || ''; // Ensure password isn't accidentally cleared

        const range = `${USERS_SHEET_NAME_ONLY}!A${rowIndex}:H${rowIndex}`;
        console.log(`[GSHEET User] Updating row ${rowIndex} with data:`, updatedRow);

        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID!,
            range: range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [updatedRow],
            },
        });

        console.log(`[GSHEET User] Successfully updated user "${login}" at row ${rowIndex}`);
        return true;
    } catch (error: any) {
        console.error(`[GSHEET User] Error updating user "${login}" in Google Sheet:`, error?.message || error);
        console.error("[GSHEET User] Check Service Account permissions and Sheet sharing settings.");
        return false;
    }
};
