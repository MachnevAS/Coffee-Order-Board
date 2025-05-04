
'use server';
/**
 * @fileoverview Service for interacting with the Google Sheets API using Service Account authentication.
 * Provides functions to fetch, add, update, and delete product data,
 * assuming a sheet structure: Name | Volume | Price | Image URL | Hint
 */
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import type { Product } from '@/types/product';
import { getRawProductData } from '@/lib/product-defaults';

// --- Service Account Authentication ---
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
// IMPORTANT: Ensure the private key is stored correctly in the environment variable,
// especially handling newline characters (e.g., replace \n with \\n).
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
// Sheet name MUST be just the name (e.g., 'price'), range is defined separately
const SHEET_NAME_ONLY = process.env.GOOGLE_SHEET_NAME;

// --- API Key (Optional for Read-Only Fallback/Alternative) ---
const API_KEY = process.env.GOOGLE_SHEETS_API_KEY; // Can still be used for read operations if preferred

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let sheets: ReturnType<typeof google.sheets> | null = null;
let authError: string | null = null;

try {
    if (!SHEET_ID || !SHEET_NAME_ONLY) {
        throw new Error("Missing Google Sheet ID or Sheet Name configuration in environment variables (GOOGLE_SHEET_ID, GOOGLE_SHEET_NAME).");
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
    else if (API_KEY) {
        console.warn("[GSHEET Auth] Using API Key credentials (read-only operations recommended).");
        authClient = API_KEY;
        // Note: Write operations (add, update, delete) will fail with only API key
    }
    else {
        throw new Error("Missing Google Sheets API credentials. Configure either Service Account (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY) or API Key (GOOGLE_SHEETS_API_KEY).");
    }

    sheets = google.sheets({ version: 'v4', auth: authClient });
    console.log("[GSHEET Auth] Google Sheets client initialized successfully.");

} catch (error: any) {
    console.error("!!! CRITICAL: Failed to initialize Google Sheets client:", error.message);
    authError = `Failed to initialize Google Sheets client: ${error.message}. Check environment variables and credentials.`;
    // Keep 'sheets' as null to indicate initialization failure
}


// Column mapping based on the new structure
const COLUMN_MAP = {
  name: 0,     // Column A
  volume: 1,   // Column B
  price: 2,    // Column C
  imageUrl: 3, // Column D
  dataAiHint: 4 // Column E
};
const HEADER_ROW_COUNT = 1;
// Define the range covering the actual data columns
const DATA_RANGE = `${SHEET_NAME_ONLY}!A${HEADER_ROW_COUNT + 1}:E`; // Read data starting after header
const FULL_RANGE_FOR_APPEND = `${SHEET_NAME_ONLY}!A:E`; // Append to columns A-E

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
  if (!row || row.length === 0 || !row[COLUMN_MAP.name]) {
    return null; // Skip empty rows or rows without a name
  }
  const name = row[COLUMN_MAP.name] ?? '';
  const volume = row[COLUMN_MAP.volume] || undefined;
  const priceStr = row[COLUMN_MAP.price]?.toString().replace(',', '.').trim(); // Handle comma decimal, trim whitespace
  const price = parseFloat(priceStr);

  // Generate a local ID based on row content and index
  // Add header offset + 1 because sheet rows are 1-based, array index is 0-based
  const localId = generateLocalId(name, volume, rowIndex + HEADER_ROW_COUNT + 1);

  return {
    id: localId, // Generated local ID
    name: name,
    volume: volume,
    price: isNaN(price) ? undefined : price,
    imageUrl: row[COLUMN_MAP.imageUrl] || undefined,
    dataAiHint: row[COLUMN_MAP.dataAiHint] || undefined,
  };
};

// Helper to convert Product object to sheet row (excluding local ID)
const productToRow = (product: Omit<Product, 'id'>): any[] => {
  const row: any[] = [];
  row[COLUMN_MAP.name] = product.name;
  row[COLUMN_MAP.volume] = product.volume ?? ''; // Use empty string for undefined
  // Format price with comma for consistency if needed, or keep as number
  row[COLUMN_MAP.price] = product.price !== undefined ? product.price : ''; // Use empty string for undefined price
  row[COLUMN_MAP.imageUrl] = product.imageUrl ?? '';
  row[COLUMN_MAP.dataAiHint] = product.dataAiHint ?? '';
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
const findRowIndexByNameAndVolume = async (name: string, volume?: string | null): Promise<number | null> => {
  if (!sheets || authError) {
    console.error(`[GSHEET] Sheets client not initialized in findRowIndexByNameAndVolume. Auth error: ${authError}`);
    return null;
  }
  const searchVolume = volume ?? ''; // Treat null/undefined volume as empty string for matching

  try {
    console.log(`[GSHEET] Searching for Name: "${name}", Volume: "${searchVolume}" in range ${SHEET_NAME_ONLY}!A:B`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID!,
      range: `${SHEET_NAME_ONLY}!A${HEADER_ROW_COUNT + 1}:B`, // Fetch Name and Volume columns starting after the header
    });
    const rows = response.data.values;
    if (!rows) {
        console.log("[GSHEET] No data rows found in Name/Volume columns.");
        return null;
    }

    // Find the index in the fetched data (0-based relative to data start)
    const indexInData = rows.findIndex(row =>
        row[COLUMN_MAP.name] === name && // Match name
        (row[COLUMN_MAP.volume] ?? '') === searchVolume // Match volume (treat null/undefined/empty as '')
    );

    if (indexInData !== -1) {
        const sheetRowIndex = indexInData + HEADER_ROW_COUNT + 1;
        console.log(`[GSHEET] Found match for "${name}", "${searchVolume}" at sheet row index: ${sheetRowIndex}`);
        return sheetRowIndex;
    } else {
        console.log(`[GSHEET] Match not found for "${name}", "${searchVolume}".`);
        return null;
    }
  } catch (error: any) {
    console.error(`[GSHEET] Error finding row index for Name "${name}", Volume "${searchVolume}":`, error?.message || error);
    // console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    return null;
  }
};

// Fetch products and generate local IDs
export const fetchProductsFromSheet = async (): Promise<Product[]> => {
  if (!sheets || authError) {
    console.error(`[GSHEET] Sheets client not initialized in fetchProductsFromSheet. Auth error: ${authError}`);
    return [];
  }
  try {
    console.log(`[GSHEET] Fetching products from range: ${DATA_RANGE}`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID!,
      range: DATA_RANGE,
    });

    const rows = response.data.values;
    if (!rows) {
      console.log("[GSHEET] No data found in the sheet range.");
      return [];
    }

    console.log(`[GSHEET] Fetched ${rows.length} data rows.`);
    const products = rows
      .map((row, index) => rowToProduct(row, index))
      .filter((product): product is Product => product !== null);

    console.log(`[GSHEET] Successfully parsed ${products.length} products.`);
    return products;
  } catch (error: any) {
    console.error('[GSHEET] Error fetching products from Google Sheet:', error?.message || error);
    // console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    throw new Error('Failed to fetch products from Google Sheet. Check Service Account/API Key permissions and Sheet ID/Permissions.');
  }
};

// Add a product (row without ID) - Requires Service Account Auth
export const addProductToSheet = async (product: Omit<Product, 'id'>): Promise<boolean> => {
   if (!sheets || authError) {
       console.error(`[GSHEET] Sheets client not initialized in addProductToSheet. Auth error: ${authError}`);
       return false;
   }
   if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
       console.error('[GSHEET] Add operation requires Service Account credentials. API Key is not sufficient.');
       return false;
   }
   if (!product.name) {
       console.error('[GSHEET] Attempted to add product without a name.');
       return false;
   }

   try {
    console.log(`[GSHEET] Attempting to add product: Name "${product.name}", Volume "${product.volume || ''}"`);
    const existingRowIndex = await findRowIndexByNameAndVolume(product.name, product.volume);
    if (existingRowIndex !== null) {
        console.warn(`[GSHEET] Product "${product.name}" (${product.volume || 'N/A'}) already exists at row ${existingRowIndex}. Skipping add.`);
        return false;
    }

    const row = productToRow(product);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID!,
      range: FULL_RANGE_FOR_APPEND,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });
    console.log(`[GSHEET] Successfully added product: Name "${product.name}", Volume "${product.volume || ''}"`);
    return true;
  } catch (error: any) {
    console.error(`[GSHEET] Error adding product "${product.name}" to Google Sheet:`, error?.message || error);
    // console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    console.error("[GSHEET] Check Service Account permissions (must allow writing) and Sheet sharing settings.");
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
    console.error(`[GSHEET] Sheets client not initialized in updateProductInSheet. Auth error: ${authError}`);
    return false;
  }
  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
      console.error('[GSHEET] Update operation requires Service Account credentials. API Key is not sufficient.');
      return false;
  }
  if (!originalName) {
    console.error('[GSHEET] Original product name missing for update.');
    return false;
  }
   if (!newData.name) {
       console.error('[GSHEET] New product name missing for update.');
       return false;
   }


  try {
    console.log(`[GSHEET] Attempting to update product originally named: "${originalName}", Volume: "${originalVolume || ''}"`);
    console.log(`[GSHEET] New data: Name "${newData.name}", Volume "${newData.volume || ''}"`);

    const rowIndex = await findRowIndexByNameAndVolume(originalName, originalVolume);
    if (rowIndex === null) {
      console.error(`[GSHEET] Product with original Name "${originalName}", Volume "${originalVolume || ''}" not found for update.`);
      return false;
    }

    // Check if the new Name+Volume combination already exists elsewhere (excluding the current row)
    const potentialConflictIndex = await findRowIndexByNameAndVolume(newData.name, newData.volume);
    if (potentialConflictIndex !== null && potentialConflictIndex !== rowIndex) {
        console.warn(`[GSHEET] Update conflict: Another product with Name "${newData.name}" and Volume "${newData.volume || ''}" already exists at row ${potentialConflictIndex}. Aborting update.`);
        return false; // Or handle as an error, depending on desired behavior
    }


    const range = `${SHEET_NAME_ONLY}!A${rowIndex}:E${rowIndex}`;
    const rowData = productToRow(newData);

    console.log(`[GSHEET] Updating row ${rowIndex} with data:`, rowData);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID!,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });
    console.log(`[GSHEET] Successfully updated product at row ${rowIndex}`);
    return true;
  } catch (error: any) {
    console.error(`[GSHEET] Error updating product originally named "${originalName}" in Google Sheet:`, error?.message || error);
    // console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    console.error("[GSHEET] Check Service Account permissions (must allow writing) and Sheet sharing settings.");
    return false;
  }
};

// Delete a product, finding it by Name and Volume - Requires Service Account Auth
export const deleteProductFromSheet = async (productIdentifier: { name: string, volume?: string | null }): Promise<boolean> => {
  if (!sheets || authError) {
    console.error(`[GSHEET] Sheets client not initialized in deleteProductFromSheet. Auth error: ${authError}`);
    return false;
  }
  if (!(SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY)) {
      console.error('[GSHEET] Delete operation requires Service Account credentials. API Key is not sufficient.');
      return false;
  }
  const { name, volume } = productIdentifier;
  if (!name) {
    console.error('[GSHEET] Attempted to delete product without a name.');
    return false;
  }

  try {
    console.log(`[GSHEET] Attempting to delete product: Name "${name}", Volume "${volume || ''}"`);
    const rowIndex = await findRowIndexByNameAndVolume(name, volume);
    if (rowIndex === null) {
      console.error(`[GSHEET] Product with Name "${name}", Volume "${volume || ''}" not found for deletion.`);
      return false;
    }

     const sheetGid = await getSheetGid(SHEET_NAME_ONLY!);
     if (sheetGid === null) {
         console.error(`[GSHEET] Could not determine sheetId for sheet name "${SHEET_NAME_ONLY}". Aborting delete.`);
         return false;
     }
     console.log(`[GSHEET] Using sheetId (gid): ${sheetGid} for deletion request.`);

    console.log(`[GSHEET] Requesting deletion of row index: ${rowIndex} (0-based: ${rowIndex - 1})`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID!,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetGid,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });
    console.log(`[GSHEET] Successfully deleted product: Name "${name}", Volume "${volume || ''}" (row ${rowIndex})`);
    return true;
  } catch (error: any) {
    console.error(`[GSHEET] Error deleting product "${name}" from Google Sheet:`, error?.message || error);
    // console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    console.error("[GSHEET] Check Service Account permissions (must allow writing) and Sheet sharing settings.");
    if ((error as any)?.message?.includes('Invalid requests[0].deleteDimension.range.sheetId')) {
         console.warn("[GSHEET] Potential sheetId mismatch. The gid used might be incorrect. Verify the getSheetGid function or hardcode if necessary.");
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

  console.log("[GSHEET] Starting syncRawProductsToSheet...");

  try {
    const rawProducts = getRawProductData();
    console.log(`[GSHEET] Found ${rawProducts.length} raw products defined.`);

    const existingProducts = await fetchProductsFromSheet(); // Fetch can use API key or SA
    const existingProductKeys = new Set(existingProducts.map(p => `${p.name}|${p.volume ?? ''}`));
    console.log(`[GSHEET] Found ${existingProductKeys.size} unique existing product combinations (Name|Volume) in the sheet.`);

    const productsToAdd = rawProducts.filter(rp => {
        const key = `${rp.name}|${rp.volume ?? ''}`;
        return !existingProductKeys.has(key);
    });
    const skippedCount = rawProducts.length - productsToAdd.length;

    console.log(`[GSHEET] Products to add: ${productsToAdd.length}, Products skipped: ${skippedCount}`);

    if (productsToAdd.length === 0) {
      console.log("[GSHEET] No new products to add.");
      return { success: true, message: "All example products are already in the sheet.", addedCount: 0, skippedCount: skippedCount };
    }

    const rowsToAdd = productsToAdd.map(productToRow);
    console.log(`[GSHEET] Attempting to append ${rowsToAdd.length} rows.`);

    const appendResult = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID!,
      range: FULL_RANGE_FOR_APPEND,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rowsToAdd,
      },
    });

    console.log("[GSHEET] Append operation successful:", JSON.stringify(appendResult.data, null, 2));
    return { success: true, message: `Successfully added ${productsToAdd.length} example products to the sheet.`, addedCount: productsToAdd.length, skippedCount: skippedCount };

  } catch (error: any) {
    console.error('[GSHEET] Error syncing raw products to Google Sheet:', error?.message || error);
    // console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    console.error("[GSHEET] Check Service Account permissions (must allow writing) and Sheet sharing settings.");
    let message = 'Failed to sync example products to Google Sheet.';
    if (error?.errors?.length > 0) {
        message += ` Error detail: ${error.errors[0].message}`;
    } else if (error?.message) {
        message += ` Error detail: ${error.message}`;
    }
    return { success: false, message: message, addedCount: 0, skippedCount: 0 };
  }
};
