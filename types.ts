
export type Phase = 'pre' | 'during' | 'post' | 'summary';

export enum Category {
  FLIGHT = '機票',
  ACCOMMODATION = '住宿',
  INSURANCE = '保險',
  SIM_WIFI = 'SIM卡/網卡',
  TRANSPORT_AIRPORT = '機場接送',
  SHOPPING_PRE = '行前採買',
  EXCHANGE = '換匯',
  SHOPPING = '購物',
  FOOD = '餐飲',
  SOUVENIR = '伴手禮/紀念品',
  TRANSPORT = '交通',
  TICKET = '票券',
  
  // New Category for Help Buy
  HELP_BUY = '朋友代買',

  // New Categories for Airport/Post-Trip
  COSMETICS = '美妝保養',
  ELECTRONICS = '3C家電',
  FASHION = '服飾鞋包',
  ACCESSORIES = '飾品配件',
  TRANSPORT_POST = '回國交通',
  
  OTHER = '其他'
}

export enum PaymentMethod {
  CREDIT_CARD = '信用卡',
  CASH_TWD = '台幣現金',
  CASH_FOREIGN = '外幣現金',
  IC_CARD = '交通卡'
}

export type SplitMethod = 'EQUAL' | 'PERCENT' | 'EXACT';

export interface Companion {
  id: string;
  name: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  isPurchased: boolean;
  phase: Phase;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  exchangeRate: number; // Rate to TWD
  handlingFee?: number; // Fee in TWD (mostly for exchange)
  twdAmount: number;
  category: Category;
  paymentMethod: PaymentMethod;
  phase: Phase;
  date: string;
  payerId: string; // 'me' or companion ID
  beneficiaries: string[]; // List of IDs including 'me' (Used for EQUAL split)
  splitMethod: SplitMethod;
  splitAllocations: Record<string, number>; // Map userID -> TWD Amount (Used for EXACT/PERCENT)
  needsReview?: boolean; // New field to flag uncertain AI results
}

export interface TaxRule {
  country: string;
  currency: string;
  minSpend: number; // Minimum spend in foreign currency
  refundRate: number; // e.g., 0.10 for 10%
  notes: string;
}

export interface Trip {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalCost: number;
  expenses: Expense[];
  companions: Companion[];
  shoppingList: ShoppingItem[];
  archivedAt: string;
  taxRule?: TaxRule;
}

export interface CurrencyOption {
  code: string;
  name: string;
  defaultRate: number; // Rough estimate defaults
}

export interface SummaryStats {
  totalTWD: number;
  byPhase: Record<Phase, number>;
  byCategory: Record<string, number>;
}
