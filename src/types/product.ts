
export interface Product {
  id: string;
  name: string;
  price: number | undefined; // Allow undefined to handle form state
  imageUrl?: string;
  dataAiHint?: string; // Added for AI image generation hints
  volume?: string; // Optional field for volume, e.g., "0,2 л", "50 мл"
}
