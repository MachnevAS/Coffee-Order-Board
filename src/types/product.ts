

export interface Product {
  id: string; // ID is always generated locally now
  name: string;
  price: number | undefined; // Allow undefined to handle form state
  imageUrl?: string;
  dataAiHint?: string;
  volume?: string; // Optional field for volume, e.g., "0,2 л", "50 мл"
}
