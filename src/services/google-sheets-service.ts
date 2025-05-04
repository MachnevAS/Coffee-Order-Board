'use server';
/**
 * @fileoverview Service for interacting with the Google Sheets API.
 * Provides functions to fetch, add, update, and delete product data,
 * assuming a sheet structure: Name | Volume | Price | Image URL | Hint
 */
import { google } from 'googleapis';
import type { Product } from '@/types/product';
import { getRawProductData } from '@/lib/product-defaults';

// IMPORTANT: Store these values securely in environment variables
const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
// Sheet name MUST be just the name (e.g., 'price'), range is defined separately
const SHEET_NAME_ONLY = process.env.GOOGLE_SHEET_NAME;

if (!API_KEY || !SHEET_ID || !SHEET_NAME_ONLY) {
  console.error("!!! CRITICAL: Missing Google Sheets API configuration in environment variables (GOOGLE_SHEETS_API_KEY, GOOGLE_SHEET_ID, GOOGLE_SHEET_NAME).");
  // Consider throwing an error in production if config is essential
  // throw new Error("Missing Google Sheets API configuration. Check environment variables.");
}

const sheets = google.sheets({ version: 'v4', auth: API_KEY });

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
  // Simple hash function (not cryptographically secure, just for local uniqueness)
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
  const priceStr = row[COLUMN_MAP.price]?.toString().replace(',', '.'); // Handle comma decimal separator
  const price = parseFloat(priceStr);

  // Generate a local ID based on row content and index
  const localId = generateLocalId(name, volume, rowIndex + HEADER_ROW_COUNT); // Add header offset to index

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
const productToRow = (product: Product): any[] => {
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
    if (!API_KEY || !SHEET_ID || !SHEET_NAME_ONLY) return null;
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SHEET_ID,
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
  if (!API_KEY || !SHEET_ID || !SHEET_NAME_ONLY) {
      console.error("[GSHEET] Sheet API config missing in findRowIndexByNameAndVolume");
      return null;
  }
  const searchVolume = volume ?? ''; // Treat null/undefined volume as empty string for matching

  try {
    console.log(`[GSHEET] Searching for Name: "${name}", Volume: "${searchVolume}" in range ${SHEET_NAME_ONLY}!A:B`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      // Fetch Name and Volume columns starting after the header
      range: `${SHEET_NAME_ONLY}!A${HEADER_ROW_COUNT + 1}:B`,
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
        // Calculate the actual row number in the sheet (1-based)
        const sheetRowIndex = indexInData + HEADER_ROW_COUNT + 1;
        console.log(`[GSHEET] Found match for "${name}", "${searchVolume}" at sheet row index: ${sheetRowIndex}`);
        return sheetRowIndex;
    } else {
        console.log(`[GSHEET] Match not found for "${name}", "${searchVolume}".`);
        return null;
    }
  } catch (error: any) {
    console.error(`[GSHEET] Error finding row index for Name "${name}", Volume "${searchVolume}":`, error?.message || error);
    console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    return null;
  }
};

// Fetch products and generate local IDs
export const fetchProductsFromSheet = async (): Promise<Product[]> => {
  if (!API_KEY || !SHEET_ID || !SHEET_NAME_ONLY) {
      console.error("[GSHEET] Sheet API config missing in fetchProductsFromSheet");
      return [];
  }
  try {
    console.log(`[GSHEET] Fetching products from range: ${DATA_RANGE}`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: DATA_RANGE, // Read only data rows
    });

    const rows = response.data.values;
    if (!rows) {
      console.log("[GSHEET] No data found in the sheet range.");
      return [];
    }

    console.log(`[GSHEET] Fetched ${rows.length} data rows.`);
    // Map rows to Product objects, generating local IDs
    const products = rows
      .map((row, index) => rowToProduct(row, index)) // Pass index for ID generation
      .filter((product): product is Product => product !== null); // Type guard to filter out nulls

    console.log(`[GSHEET] Successfully parsed ${products.length} products.`);
    return products;
  } catch (error: any) {
    console.error('[GSHEET] Error fetching products from Google Sheet:', error?.message || error);
    console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    throw new Error('Failed to fetch products from Google Sheet. Check API Key/Sheet ID/Permissions.');
  }
};

// Add a product (row without ID)
export const addProductToSheet = async (product: Omit<Product, 'id'>): Promise<boolean> => {
   if (!API_KEY || !SHEET_ID || !SHEET_NAME_ONLY) {
       console.error("[GSHEET] Sheet API config missing in addProductToSheet");
       return false;
   }
   if (!product.name) {
       console.error('[GSHEET] Attempted to add product without a name.');
       return false;
   }

   try {
    console.log(`[GSHEET] Attempting to add product: Name "${product.name}", Volume "${product.volume || ''}"`);
    // Check if product already exists
    const existingRowIndex = await findRowIndexByNameAndVolume(product.name, product.volume);
    if (existingRowIndex !== null) {
        console.warn(`[GSHEET] Product "${product.name}" (${product.volume || 'N/A'}) already exists at row ${existingRowIndex}. Skipping add.`);
        // Optionally, you could update here instead of skipping
        // return updateProductInSheet(product); // Assuming updateProductInSheet can handle Omit<Product, 'id'>
        return false; // Indicate skipped/failed add
    }

    const row = productToRow(product as Product); // Convert, ID won't be used
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: FULL_RANGE_FOR_APPEND, // Append to the end of the defined columns
      valueInputOption: 'USER_ENTERED', // Use USER_ENTERED for potential formulas/formatting
      requestBody: {
        values: [row],
      },
    });
    console.log(`[GSHEET] Successfully added product: Name "${product.name}", Volume "${product.volume || ''}"`);
    return true;
  } catch (error: any) {
    console.error(`[GSHEET] Error adding product "${product.name}" to Google Sheet:`, error?.message || error);
    console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
     console.error("[GSHEET] Check API Key permissions (must allow writing) and Sheet sharing settings.");
    return false; // Indicate failure
  }
};

// Update a product, finding it by Name and Volume
export const updateProductInSheet = async (product: Omit<Product, 'id'>): Promise<boolean> => {
  if (!API_KEY || !SHEET_ID || !SHEET_NAME_ONLY) {
      console.error("[GSHEET] Sheet API config missing in updateProductInSheet");
      return false;
  }
  if (!product.name) {
    console.error('[GSHEET] Attempted to update product without a name.');
    return false;
  }

  try {
    console.log(`[GSHEET] Attempting to update product: Name "${product.name}", Volume "${product.volume || ''}"`);
    const rowIndex = await findRowIndexByNameAndVolume(product.name, product.volume);
    if (rowIndex === null) {
      console.error(`[GSHEET] Product with Name "${product.name}", Volume "${product.volume || ''}" not found for update.`);
      return false; // Product not found
    }

    const range = `${SHEET_NAME_ONLY}!A${rowIndex}:E${rowIndex}`; // Range for the specific row (A:E)
    const rowData = productToRow(product as Product); // Convert, ID won't be used

    console.log(`[GSHEET] Updating row ${rowIndex} with data:`, rowData);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        // Need to provide values for all columns in the range A:E
        values: [rowData],
      },
    });
    console.log(`[GSHEET] Successfully updated product at row ${rowIndex}`);
    return true;
  } catch (error: any) {
    console.error(`[GSHEET] Error updating product "${product.name}" in Google Sheet:`, error?.message || error);
    console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    console.error("[GSHEET] Check API Key permissions (must allow writing) and Sheet sharing settings.");
    return false; // Indicate failure
  }
};

// Delete a product, finding it by Name and Volume
export const deleteProductFromSheet = async (productIdentifier: { name: string, volume?: string | null }): Promise<boolean> => {
  if (!API_KEY || !SHEET_ID || !SHEET_NAME_ONLY) {
      console.error("[GSHEET] Sheet API config missing in deleteProductFromSheet");
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
      return false; // Product not found
    }

     const sheetGid = await getSheetGid(SHEET_NAME_ONLY);
     if (sheetGid === null) {
         console.error(`[GSHEET] Could not determine sheetId for sheet name "${SHEET_NAME_ONLY}". Aborting delete.`);
         return false;
     }
     console.log(`[GSHEET] Using sheetId (gid): ${sheetGid} for deletion request.`);

    console.log(`[GSHEET] Requesting deletion of row index: ${rowIndex} (0-based: ${rowIndex - 1})`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetGid,
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // API uses 0-based index
                endIndex: rowIndex,       // API endIndex is exclusive
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
    console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    console.error("[GSHEET] Check API Key permissions (must allow writing) and Sheet sharing settings.");
    if ((error as any)?.message?.includes('Invalid requests[0].deleteDimension.range.sheetId')) {
         console.warn("[GSHEET] Potential sheetId mismatch. The gid used might be incorrect. Verify the getSheetGid function or hardcode if necessary.");
    }
    return false; // Indicate failure
  }
};

// Function to add the raw products (defined in product-defaults) to the Google Sheet
export const syncRawProductsToSheet = async (): Promise<{ success: boolean; message: string; addedCount: number; skippedCount: number }> => {
  if (!API_KEY || !SHEET_ID || !SHEET_NAME_ONLY) {
    return { success: false, message: "Google Sheets API configuration is missing.", addedCount: 0, skippedCount: 0 };
  }

  console.log("[GSHEET] Starting syncRawProductsToSheet...");

  try {
    const rawProducts = getRawProductData(); // These already have local IDs, but we don't use them for syncing
    console.log(`[GSHEET] Found ${rawProducts.length} raw products defined.`);

    const existingProducts = await fetchProductsFromSheet(); // Fetches with local IDs
    // Create a Set of existing products based on Name and Volume for efficient lookup
    const existingProductKeys = new Set(existingProducts.map(p => `${p.name}|${p.volume ?? ''}`));
    console.log(`[GSHEET] Found ${existingProductKeys.size} unique existing product combinations (Name|Volume) in the sheet.`);

    const productsToAdd = rawProducts.filter(rp => {
        const key = `${rp.name}|${rp.volume ?? ''}`;
        const shouldAdd = !existingProductKeys.has(key);
        // if (!shouldAdd) console.log(`[GSHEET] Skipping existing product: Name "${rp.name}", Volume "${rp.volume ?? ''}"`);
        return shouldAdd;
    });
    const skippedCount = rawProducts.length - productsToAdd.length;

    console.log(`[GSHEET] Products to add: ${productsToAdd.length}, Products skipped: ${skippedCount}`);

    if (productsToAdd.length === 0) {
      console.log("[GSHEET] No new products to add.");
      return { success: true, message: "All example products are already in the sheet.", addedCount: 0, skippedCount: skippedCount };
    }

    // Prepare rows for appending (without local IDs)
    const rowsToAdd = productsToAdd.map(productToRow);
    console.log(`[GSHEET] Attempting to append ${rowsToAdd.length} rows.`);

    const appendResult = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: FULL_RANGE_FOR_APPEND, // Append to the defined columns
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rowsToAdd,
      },
    });

    console.log("[GSHEET] Append operation successful:", JSON.stringify(appendResult.data, null, 2));
    return { success: true, message: `Successfully added ${productsToAdd.length} example products to the sheet.`, addedCount: productsToAdd.length, skippedCount: skippedCount };

  } catch (error: any) {
    console.error('[GSHEET] Error syncing raw products to Google Sheet:', error?.message || error);
    console.error("[GSHEET] Full error object:", JSON.stringify(error, null, 2));
    console.error("[GSHEET] Check API Key permissions (must allow writing) and Sheet sharing settings.");
    let message = 'Failed to sync example products to Google Sheet.';
    if (error?.errors?.length > 0) {
        message += ` Error detail: ${error.errors[0].message}`;
    } else if (error?.message) {
        message += ` Error detail: ${error.message}`;
    }
    return { success: false, message: message, addedCount: 0, skippedCount: 0 };
  }
};
