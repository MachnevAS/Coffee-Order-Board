'use server';
/**
 * @fileoverview Service for interacting with the Google Sheets API.
 * Provides functions to fetch, add, update, and delete product data.
 */
import { google } from 'googleapis';
import type { Product } from '@/types/product';
import { getRawProductData } from '@/lib/product-defaults';

// IMPORTANT: Store these values securely in environment variables
const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME; // e.g., 'price!A:F' or just 'price' if reading whole sheet initially

if (!API_KEY || !SHEET_ID || !SHEET_NAME) {
  console.error("!!! CRITICAL: Missing Google Sheets API configuration in environment variables (GOOGLE_SHEETS_API_KEY, GOOGLE_SHEET_ID, GOOGLE_SHEET_NAME).");
  // Throw an error to prevent the application from running without proper configuration
  // throw new Error("Missing Google Sheets API configuration. Check environment variables.");
}

const sheets = google.sheets({ version: 'v4', auth: API_KEY });

const COLUMN_MAP = {
  id: 0,       // Column A
  name: 1,     // Column B
  volume: 2,   // Column C
  price: 3,    // Column D
  imageUrl: 4, // Column E
  dataAiHint: 5 // Column F
};
const HEADER_ROW_COUNT = 1;
const FULL_RANGE = `${SHEET_NAME}!A:F`; // Assuming data is in columns A to F

// Helper to convert sheet row to Product object
const rowToProduct = (row: any[]): Product | null => {
  if (!row || row.length === 0 || !row[COLUMN_MAP.id] || !row[COLUMN_MAP.name]) {
    return null; // Skip empty or invalid rows
  }
  const price = parseFloat(row[COLUMN_MAP.price]);
  return {
    id: row[COLUMN_MAP.id]?.toString() ?? '', // Ensure ID is string
    name: row[COLUMN_MAP.name] ?? '',
    volume: row[COLUMN_MAP.volume] || undefined,
    price: isNaN(price) ? undefined : price,
    imageUrl: row[COLUMN_MAP.imageUrl] || undefined,
    dataAiHint: row[COLUMN_MAP.dataAiHint] || undefined,
  };
};

// Helper to convert Product object to sheet row
const productToRow = (product: Product): any[] => {
  const row: any[] = [];
  row[COLUMN_MAP.id] = product.id;
  row[COLUMN_MAP.name] = product.name;
  row[COLUMN_MAP.volume] = product.volume ?? ''; // Use empty string for undefined
  row[COLUMN_MAP.price] = product.price !== undefined ? product.price : ''; // Use empty string for undefined price
  row[COLUMN_MAP.imageUrl] = product.imageUrl ?? '';
  row[COLUMN_MAP.dataAiHint] = product.dataAiHint ?? '';
  return row;
};

// Helper function to get the sheetId (gid) for a given sheet name
// Note: This makes an extra API call, consider caching if performance is critical
const getSheetGid = async (sheetName: string): Promise<number | null> => {
    if (!API_KEY || !SHEET_ID || !SHEET_NAME) return null;
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SHEET_ID,
            fields: 'sheets(properties(sheetId,title))', // Request only necessary fields
        });
        const sheetProperties = response.data.sheets?.find(
            (sheet) => sheet.properties?.title === sheetName
        )?.properties;

        if (sheetProperties?.sheetId !== undefined && sheetProperties?.sheetId !== null) {
            return sheetProperties.sheetId;
        } else {
            console.error(`Could not find sheetId for sheet named "${sheetName}"`);
            return null;
        }
    } catch (error: any) {
        console.error(`Error fetching sheetId for "${sheetName}":`, error?.message || error);
        return null;
    }
};


// Helper to find the row number of a product by ID
const findRowIndexById = async (productId: string): Promise<number | null> => {
  if (!API_KEY || !SHEET_ID || !SHEET_NAME) {
      console.error("Sheet API config missing in findRowIndexById");
      return null;
  }
  try {
    console.log(`Searching for product ID: ${productId} in range ${SHEET_NAME}!A:A`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:A`, // Only need the ID column
    });
    const rows = response.data.values;
    if (!rows) {
        console.log("No rows found in ID column.");
        return null;
    }
    // Find the index (row number is index + 1, adjust for header)
    const index = rows.findIndex(row => row[0] === productId);
     if (index !== -1) {
        const rowIndex = index + HEADER_ROW_COUNT; // +1 for 1-based index, + (HEADER_ROW_COUNT -1) for header offset
        console.log(`Found product ID ${productId} at row index: ${rowIndex}`);
        return rowIndex;
    } else {
        console.log(`Product ID ${productId} not found.`);
        return null;
    }
  } catch (error: any) {
    console.error(`Error finding row index for product ${productId}:`, error?.message || error);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    return null;
  }
};


export const fetchProductsFromSheet = async (): Promise<Product[]> => {
  if (!API_KEY || !SHEET_ID || !SHEET_NAME) {
      console.error("Sheet API config missing in fetchProductsFromSheet");
      return [];
  }
  try {
    console.log(`Fetching products from range: ${FULL_RANGE}`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: FULL_RANGE, // Fetch all relevant columns
    });

    const rows = response.data.values;
    if (!rows) {
      console.log("No data found in the sheet range.");
      return [];
    }

    console.log(`Fetched ${rows.length} total rows (including header).`);
    // Skip header row(s) and map valid rows to Product objects
    const products = rows
      .slice(HEADER_ROW_COUNT)
      .map(rowToProduct)
      .filter((product): product is Product => product !== null); // Type guard to filter out nulls

    console.log(`Successfully parsed ${products.length} products.`);
    return products;
  } catch (error: any) {
    console.error('Error fetching products from Google Sheet:', error?.message || error);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    // Consider how to handle this in the UI - maybe return empty array with a specific error state?
    // For now, re-throwing might be caught by a higher-level error boundary.
    throw new Error('Failed to fetch products from Google Sheet. Check API Key/Sheet ID/Permissions.');
  }
};

export const addProductToSheet = async (product: Product): Promise<boolean> => {
   if (!API_KEY || !SHEET_ID || !SHEET_NAME) {
       console.error("Sheet API config missing in addProductToSheet");
       return false;
   }
   // Ensure product has an ID
   if (!product.id) {
       console.error('Attempted to add product without an ID.');
       return false;
   }

   try {
    console.log(`Attempting to add product ID: ${product.id}`);
    const row = productToRow(product);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: FULL_RANGE, // Append to the end of the table defined by FULL_RANGE
      valueInputOption: 'USER_ENTERED', // Or 'RAW' if you don't need parsing
      requestBody: {
        values: [row],
      },
    });
    console.log(`Successfully added product ID: ${product.id}`);
    return true;
  } catch (error: any) {
    console.error(`Error adding product ${product.id} to Google Sheet:`, error?.message || error);
    console.error("Full error object:", JSON.stringify(error, null, 2));
     console.error("Check API Key permissions (must allow writing) and Sheet sharing settings.");
    return false; // Indicate failure
  }
};

export const updateProductInSheet = async (product: Product): Promise<boolean> => {
  if (!API_KEY || !SHEET_ID || !SHEET_NAME) {
      console.error("Sheet API config missing in updateProductInSheet");
      return false;
  }
  if (!product.id) {
    console.error('Attempted to update product without an ID.');
    return false;
  }

  try {
    console.log(`Attempting to update product ID: ${product.id}`);
    const rowIndex = await findRowIndexById(product.id);
    if (rowIndex === null) {
      console.error(`Product with ID ${product.id} not found for update.`);
      return false; // Product not found
    }

    const range = `${SHEET_NAME}!A${rowIndex}:F${rowIndex}`; // Range for the specific row
    const rowData = productToRow(product);

    console.log(`Updating row ${rowIndex} with data:`, rowData);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });
    console.log(`Successfully updated product ID: ${product.id} at row ${rowIndex}`);
    return true;
  } catch (error: any) {
    console.error(`Error updating product ${product.id} in Google Sheet:`, error?.message || error);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    console.error("Check API Key permissions (must allow writing) and Sheet sharing settings.");
    return false; // Indicate failure
  }
};

export const deleteProductFromSheet = async (productId: string): Promise<boolean> => {
  if (!API_KEY || !SHEET_ID || !SHEET_NAME) {
      console.error("Sheet API config missing in deleteProductFromSheet");
      return false;
  }
  try {
    console.log(`Attempting to delete product ID: ${productId}`);
    const rowIndex = await findRowIndexById(productId);
    if (rowIndex === null) {
      console.error(`Product with ID ${productId} not found for deletion.`);
      return false; // Product not found
    }

     // Dynamically get the sheetId (gid)
     const sheetGid = await getSheetGid(SHEET_NAME);
     if (sheetGid === null) {
         console.error(`Could not determine sheetId for sheet name "${SHEET_NAME}". Aborting delete.`);
         return false;
     }
     console.log(`Using sheetId (gid): ${sheetGid} for deletion request.`);


    console.log(`Requesting deletion of row index: ${rowIndex} (0-based: ${rowIndex - 1})`);
    // Google Sheets API deletes rows using batchUpdate with a deleteDimension request
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetGid, // Use the dynamically fetched sheetId
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // API uses 0-based index
                endIndex: rowIndex,       // API endIndex is exclusive
              },
            },
          },
        ],
      },
    });
    console.log(`Successfully deleted product ID: ${productId} (row ${rowIndex})`);
    return true;
  } catch (error: any) {
    console.error(`Error deleting product ${productId} from Google Sheet:`, error?.message || error);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    console.error("Check API Key permissions (must allow writing) and Sheet sharing settings.");
    // Specific check for sheetId error
    if ((error as any)?.message?.includes('Invalid requests[0].deleteDimension.range.sheetId')) {
         console.warn("Potential sheetId mismatch. The gid used might be incorrect. Verify the getSheetGid function or hardcode if necessary.");
    }
    return false; // Indicate failure
  }
};

// Function to add the raw products to the Google Sheet
export const syncRawProductsToSheet = async (): Promise<{ success: boolean; message: string; addedCount: number; skippedCount: number }> => {
  if (!API_KEY || !SHEET_ID || !SHEET_NAME) {
    return { success: false, message: "Google Sheets API configuration is missing.", addedCount: 0, skippedCount: 0 };
  }

  console.log("Starting syncRawProductsToSheet...");

  try {
    const rawProducts = getRawProductData();
    console.log(`Found ${rawProducts.length} raw products defined.`);

    const existingProducts = await fetchProductsFromSheet();
    const existingProductIds = new Set(existingProducts.map(p => p.id));
    console.log(`Found ${existingProductIds.size} existing product IDs in the sheet.`);

    const productsToAdd = rawProducts.filter(rp => {
        const shouldAdd = !existingProductIds.has(rp.id);
        // if (!shouldAdd) console.log(`Skipping existing product ID: ${rp.id}`);
        return shouldAdd;
    });
    const skippedCount = rawProducts.length - productsToAdd.length;

    console.log(`Products to add: ${productsToAdd.length}, Products skipped: ${skippedCount}`);

    if (productsToAdd.length === 0) {
      console.log("No new products to add.");
      return { success: true, message: "All example products are already in the sheet.", addedCount: 0, skippedCount: skippedCount };
    }

    const rowsToAdd = productsToAdd.map(productToRow);
    console.log(`Attempting to append ${rowsToAdd.length} rows.`);

    const appendResult = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: FULL_RANGE, // Append to the table defined by FULL_RANGE
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rowsToAdd,
      },
    });

    console.log("Append operation successful:", JSON.stringify(appendResult.data, null, 2));
    return { success: true, message: `Successfully added ${productsToAdd.length} example products to the sheet.`, addedCount: productsToAdd.length, skippedCount: skippedCount };

  } catch (error: any) {
    console.error('Error syncing raw products to Google Sheet:', error?.message || error);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    console.error("Check API Key permissions (must allow writing) and Sheet sharing settings.");
    // Provide a more specific error message if possible
    let message = 'Failed to sync example products to Google Sheet.';
    if (error?.errors?.length > 0) {
        message += ` Error detail: ${error.errors[0].message}`;
    } else if (error?.message) {
        message += ` Error detail: ${error.message}`;
    }
    return { success: false, message: message, addedCount: 0, skippedCount: 0 };
  }
};
    