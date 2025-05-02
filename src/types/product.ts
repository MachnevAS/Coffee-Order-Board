export interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  dataAiHint?: string; // Added for AI image generation hints
}
