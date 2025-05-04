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
  console.error("Missing Google Sheets API configuration in environment variables.");
  // Optionally throw an error or handle this case appropriately
  // throw new Error("Missing Google Sheets API configuration.");
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

// Helper to find the row number of a product by ID
const findRowIndexById = async (productId: string): Promise<number | null> => {
  if (!API_KEY || !SHEET_ID || !SHEET_NAME) return null;
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:A`, // Only need the ID column
    });
    const rows = response.data.values;
    if (!rows) return null;
    // Find the index (row number is index + 1, adjust for header)
    const index = rows.findIndex(row => row[0] === productId);
    return index !== -1 ? index + HEADER_ROW_COUNT : null; // +1 for 1-based index, + (HEADER_ROW_COUNT -1) for header offset
  } catch (error) {
    console.error(`Error finding row index for product ${productId}:`, error);
    return null;
  }
};


export const fetchProductsFromSheet = async (): Promise<Product[]> => {
  if (!API_KEY || !SHEET_ID || !SHEET_NAME) return [];
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: FULL_RANGE, // Fetch all relevant columns
    });

    const rows = response.data.values;
    if (!rows) {
      return [];
    }

    // Skip header row(s) and map valid rows to Product objects
    const products = rows
      .slice(HEADER_ROW_COUNT)
      .map(rowToProduct)
      .filter((product): product is Product => product !== null); // Type guard to filter out nulls

    return products;
  } catch (error) {
    console.error('Error fetching products from Google Sheet:', error);
    throw new Error('Failed to fetch products from Google Sheet.'); // Re-throw for flow handling
  }
};

export const addProductToSheet = async (product: Product): Promise<boolean> => {
   if (!API_KEY || !SHEET_ID || !SHEET_NAME) return false;
   // Ensure product has an ID
   if (!product.id) {
       console.error('Attempted to add product without an ID.');
       return false;
   }

   try {
    const row = productToRow(product);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: FULL_RANGE, // Append to the end of the table
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });
    return true;
  } catch (error) {
    console.error('Error adding product to Google Sheet:', error);
    return false; // Indicate failure
  }
};

export const updateProductInSheet = async (product: Product): Promise<boolean> => {
  if (!API_KEY || !SHEET_ID || !SHEET_NAME) return false;
  if (!product.id) {
    console.error('Attempted to update product without an ID.');
    return false;
  }

  try {
    const rowIndex = await findRowIndexById(product.id);
    if (rowIndex === null) {
      console.error(`Product with ID ${product.id} not found for update.`);
      return false; // Product not found
    }

    const range = `${SHEET_NAME}!A${rowIndex}:F${rowIndex}`; // Range for the specific row
    const rowData = productToRow(product);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });
    return true;
  } catch (error) {
    console.error(`Error updating product ${product.id} in Google Sheet:`, error);
    return false; // Indicate failure
  }
};

export const deleteProductFromSheet = async (productId: string): Promise<boolean> => {
  if (!API_KEY || !SHEET_ID || !SHEET_NAME) return false;
  try {
    const rowIndex = await findRowIndexById(productId);
    if (rowIndex === null) {
      console.error(`Product with ID ${productId} not found for deletion.`);
      return false; // Product not found
    }

    // Google Sheets API deletes rows using batchUpdate with a deleteDimension request
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0, // Assuming the first sheet (Sheet1 has sheetId 0) - THIS MIGHT NEED ADJUSTMENT
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // API uses 0-based index
                endIndex: rowIndex,       // API endIndex is exclusive
              },
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    console.error(`Error deleting product ${productId} from Google Sheet:`, error);
    // Attempt to handle potential sheetId error (heuristic)
    if ((error as any)?.message?.includes('sheetId')) {
         console.warn("Potential sheetId mismatch. Ensure the sheetId in deleteProductFromSheet is correct for your target sheet.");
    }
    return false; // Indicate failure
  }
};

// Function to add the raw products to the Google Sheet
export const syncRawProductsToSheet = async (): Promise<{ success: boolean; message: string; addedCount: number; skippedCount: number }> => {
  if (!API_KEY || !SHEET_ID || !SHEET_NAME) {
    return { success: false, message: "Google Sheets API configuration is missing.", addedCount: 0, skippedCount: 0 };
  }

  try {
    const rawProducts = getRawProductData();
    const existingProducts = await fetchProductsFromSheet();
    const existingProductIds = new Set(existingProducts.map(p => p.id));

    const productsToAdd = rawProducts.filter(rp => !existingProductIds.has(rp.id));
    const skippedCount = rawProducts.length - productsToAdd.length;

    if (productsToAdd.length === 0) {
      return { success: true, message: "All example products are already in the sheet.", addedCount: 0, skippedCount: skippedCount };
    }

    const rowsToAdd = productsToAdd.map(productToRow);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: FULL_RANGE, // Append to the end of the table
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rowsToAdd,
      },
    });

    return { success: true, message: `Successfully added ${productsToAdd.length} example products to the sheet.`, addedCount: productsToAdd.length, skippedCount: skippedCount };

  } catch (error) {
    console.error('Error syncing raw products to Google Sheet:', error);
    return { success: false, message: 'Failed to sync example products to Google Sheet.', addedCount: 0, skippedCount: 0 };
  }
};
