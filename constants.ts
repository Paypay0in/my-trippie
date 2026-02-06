
import { Category, Phase, CurrencyOption, PaymentMethod } from './types';
import { Plane, Home, Shield, Wifi, Car, ShoppingBag, Coffee, Gift, Ticket, MoreHorizontal, ArrowRightLeft, CreditCard, Banknote, Bus, Coins, Trophy, Sparkles, Smartphone, Shirt, Gem, Watch, HandHelping } from 'lucide-react';

export const PHASES: { id: Phase; label: string; color: string; icon?: any }[] = [
  { id: 'pre', label: '旅行前', color: 'bg-phase-pre' },
  { id: 'during', label: '旅行中', color: 'bg-phase-during' },
  { id: 'post', label: '回國機場消費', color: 'bg-phase-post' },
  { id: 'summary', label: '旅行結算', color: 'bg-slate-700', icon: Trophy },
];

export const CATEGORIES_BY_PHASE: Record<Phase, Category[]> = {
  pre: [
    Category.FLIGHT,
    Category.ACCOMMODATION,
    Category.INSURANCE,
    Category.SIM_WIFI,
    Category.TRANSPORT_AIRPORT,
    Category.EXCHANGE,
    Category.SHOPPING_PRE,
    Category.HELP_BUY,
    Category.OTHER
  ],
  during: [
    Category.FOOD,
    Category.SHOPPING,
    Category.SOUVENIR,
    Category.HELP_BUY,
    Category.TRANSPORT,
    Category.TICKET,
    Category.EXCHANGE,
    Category.OTHER
  ],
  post: [
    Category.COSMETICS,
    Category.ELECTRONICS,
    Category.SOUVENIR,
    Category.FASHION,
    Category.ACCESSORIES,
    Category.FOOD,
    Category.TRANSPORT_POST,
    Category.HELP_BUY,
    Category.OTHER
  ],
  summary: [] // No categories for summary view
};

export const PRE_TRIP_SUGGESTIONS = [
  { category: Category.FLIGHT, label: '機票', icon: Plane },
  { category: Category.ACCOMMODATION, label: '住宿', icon: Home },
  { category: Category.INSURANCE, label: '保險', icon: Shield },
  { category: Category.SIM_WIFI, label: '網卡/漫遊', icon: Wifi },
  { category: Category.EXCHANGE, label: '換匯', icon: ArrowRightLeft },
  { category: Category.TRANSPORT_AIRPORT, label: '機場接送', icon: Car },
];

export const POST_TRIP_SUGGESTIONS = [
  { category: Category.COSMETICS, label: '美妝保養', icon: Sparkles },
  { category: Category.ELECTRONICS, label: '3C家電', icon: Smartphone },
  { category: Category.SOUVENIR, label: '伴手禮/紀念品', icon: Gift },
  { category: Category.FASHION, label: '服飾鞋包', icon: Shirt },
  { category: Category.ACCESSORIES, label: '飾品配件', icon: Gem },
  { category: Category.TRANSPORT_POST, label: '回國交通', icon: Car },
];

export const COMMON_CURRENCIES: CurrencyOption[] = [
  { code: 'TWD', name: '新台幣', defaultRate: 1 },
  { code: 'JPY', name: '日圓', defaultRate: 0.22 },
  { code: 'USD', name: '美金', defaultRate: 32.5 },
  { code: 'EUR', name: '歐元', defaultRate: 35.0 },
  { code: 'KRW', name: '韓元', defaultRate: 0.024 },
  { code: 'CNY', name: '人民幣', defaultRate: 4.5 },
  { code: 'THB', name: '泰銖', defaultRate: 0.9 },
  { code: 'GBP', name: '英鎊', defaultRate: 41.0 },
];

export const POPULAR_COUNTRIES = [
  '日本', '韓國', '泰國', '美國', '法國', '英國', '義大利', '德國', '澳洲', '新加坡', '越南', '中國', '香港', '澳門'
];

export const PAYMENT_METHODS_CONFIG = {
  [PaymentMethod.CREDIT_CARD]: { label: '信用卡', icon: CreditCard, color: 'text-blue-600 bg-blue-50' },
  [PaymentMethod.CASH_TWD]: { label: '台幣現金', icon: Banknote, color: 'text-emerald-600 bg-emerald-50' },
  [PaymentMethod.CASH_FOREIGN]: { label: '外幣現金', icon: Coins, color: 'text-orange-600 bg-orange-50' },
  [PaymentMethod.IC_CARD]: { label: '交通卡', icon: Bus, color: 'text-purple-600 bg-purple-50' },
};

export const getCategoryIcon = (category: Category) => {
  switch (category) {
    case Category.FLIGHT: return Plane;
    case Category.ACCOMMODATION: return Home;
    case Category.INSURANCE: return Shield;
    case Category.SIM_WIFI: return Wifi;
    case Category.TRANSPORT_AIRPORT: return Car;
    case Category.SHOPPING_PRE: return ShoppingBag;
    case Category.EXCHANGE: return ArrowRightLeft;
    case Category.SHOPPING: return ShoppingBag;
    case Category.FOOD: return Coffee;
    case Category.SOUVENIR: return Gift;
    case Category.TRANSPORT: return Bus;
    case Category.TICKET: return Ticket;
    case Category.COSMETICS: return Sparkles;
    case Category.ELECTRONICS: return Smartphone;
    case Category.FASHION: return Shirt;
    case Category.ACCESSORIES: return Gem;
    case Category.HELP_BUY: return HandHelping;
    case Category.TRANSPORT_POST: return Car;
    default: return MoreHorizontal;
  }
};
