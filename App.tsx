
import React, { useState, useEffect } from 'react';
import { Phase, Expense, Category, Trip, PaymentMethod, Companion, ShoppingItem, TaxRule } from './types';
import { fetchTaxRefundRules, parseImageExpenseWithGemini } from './services/geminiService';
import { CATEGORIES_BY_PHASE, COMMON_CURRENCIES } from './constants';
import PhaseSelector from './components/PhaseSelector';
import ExpenseForm from './components/ExpenseForm';
import ExpenseList from './components/ExpenseList';
import Dashboard from './components/Dashboard';
import PreTripChecklist from './components/PreTripChecklist';
import PostTripChecklist from './components/PostTripChecklist';
import ShoppingListPanel from './components/ShoppingListPanel';
import TripSummaryModal from './components/TripSummaryModal';
import CompanionsModal from './components/CompanionsModal';
import CountrySettingsModal from './components/CountrySettingsModal';
import TripSelectionScreen from './components/TripSelectionScreen';
import { Plus, CheckCircle, Trash2, Users, Globe, ArrowLeft, Book, Pencil, CalendarDays } from 'lucide-react';

// Helper to generate unique IDs safe for all environments
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
};

// Helper to calculate date range from expenses (Fallback if no explicit date set)
const getExpenseDateRange = (expensesList: Expense[]) => {
    if (expensesList.length === 0) {
        const today = new Date().toISOString();
        return { start: today, end: today };
    }
    const sorted = [...expensesList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return { start: sorted[0].date, end: sorted[sorted.length - 1].date };
};

// Helper to format date range for display (e.g. 2024/01/01 - 01/05)
const formatDateRange = (s: string, e: string) => {
    if (!s || !e) return '';
    const start = s.split('T')[0].replace(/-/g, '/');
    const end = e.split('T')[0].replace(/-/g, '/');
    if (start === end) return start;
    // Check if same year
    if (start.substring(0, 4) === end.substring(0, 4)) {
        return `${start} - ${end.substring(5)}`;
    }
    return `${start} - ${end}`;
};

// Helper to migrate legacy expenses
const migrateExpenses = (data: any[]): Expense[] => {
    return data.map(e => {
        let updated = { ...e };
        if (updated.paymentMethod === '現金') {
            updated.paymentMethod = updated.currency === 'TWD' ? PaymentMethod.CASH_TWD : PaymentMethod.CASH_FOREIGN;
        }
        if (!updated.payerId) {
            updated.payerId = 'me';
            updated.beneficiaries = ['me'];
        }
        if (!updated.splitMethod) {
            updated.splitMethod = 'EQUAL';
            updated.splitAllocations = {};
        }
        // Ensure needsReview is preserved if present
        if (updated.needsReview === undefined) {
             updated.needsReview = false;
        }
        return updated as Expense;
    });
};

// Helper to migrate legacy shopping list
const migrateShoppingList = (data: any[]): ShoppingItem[] => {
    return data.map(item => ({
        ...item,
        phase: item.phase || 'pre' // Default legacy items to 'pre'
    }));
};

const App: React.FC = () => {
  // Navigation State
  const [viewMode, setViewMode] = useState<'bookshelf' | 'trip'>('bookshelf');

  const [currentPhase, setCurrentPhase] = useState<Phase>('pre');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCompanionsOpen, setIsCompanionsOpen] = useState(false);
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  
  // Form Prefill State
  const [initialFormCategory, setInitialFormCategory] = useState<Category | undefined>(undefined);
  const [initialFormDescription, setInitialFormDescription] = useState<string | undefined>(undefined);
  const [formLinkedItemId, setFormLinkedItemId] = useState<string | undefined>(undefined);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  
  // Country & Tax Rules
  const [travelCountry, setTravelCountry] = useState<string>(() => {
      return localStorage.getItem('trippie_country') || '';
  });
  const [taxRule, setTaxRule] = useState<TaxRule | null>(() => {
      const saved = localStorage.getItem('trippie_tax_rule');
      return saved ? JSON.parse(saved) : null;
  });
  const [isFetchingTaxRule, setIsFetchingTaxRule] = useState(false);

  // Companions State
  const [companions, setCompanions] = useState<Companion[]>(() => {
    const saved = localStorage.getItem('trippie_companions');
    return saved ? JSON.parse(saved) : [];
  });

  // Shopping List State
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => {
      const saved = localStorage.getItem('trippie_shopping_list');
      return saved ? migrateShoppingList(JSON.parse(saved)) : [];
  });

  // Current Expenses (The Active Draft)
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('trippie_expenses');
    return saved ? migrateExpenses(JSON.parse(saved)) : [];
  });

  // Trip Dates (Explicitly set by AI or User, separate from expense dates)
  const [tripStartDate, setTripStartDate] = useState<string>(() => {
      return localStorage.getItem('trippie_trip_start_date') || '';
  });
  const [tripEndDate, setTripEndDate] = useState<string>(() => {
      return localStorage.getItem('trippie_trip_end_date') || '';
  });

  // Track which historical trip is currently loaded
  const [currentLoadedTripId, setCurrentLoadedTripId] = useState<string | null>(() => {
    return localStorage.getItem('trippie_current_trip_id');
  });

  // Draft Name State (For new trips before archiving)
  const [draftName, setDraftName] = useState<string>(() => {
      return localStorage.getItem('trippie_draft_name') || '';
  });

  // Archived Trips
  const [tripHistory, setTripHistory] = useState<Trip[]>(() => {
    const saved = localStorage.getItem('trippie_history');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return parsed.map((trip: any) => ({
        ...trip,
        expenses: migrateExpenses(trip.expenses),
        companions: trip.companions || [],
        shoppingList: trip.shoppingList ? migrateShoppingList(trip.shoppingList) : [],
        taxRule: trip.taxRule || undefined // Ensure legacy data works
    }));
  });

  // Determine initial view mode
  useEffect(() => {
     // Persist logic handled by localStorage hooks below
  }, []);

  // Persistance
  useEffect(() => { localStorage.setItem('trippie_expenses', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem('trippie_companions', JSON.stringify(companions)); }, [companions]);
  useEffect(() => { localStorage.setItem('trippie_shopping_list', JSON.stringify(shoppingList)); }, [shoppingList]);
  useEffect(() => { localStorage.setItem('trippie_history', JSON.stringify(tripHistory)); }, [tripHistory]);
  useEffect(() => { localStorage.setItem('trippie_country', travelCountry); }, [travelCountry]);
  useEffect(() => { localStorage.setItem('trippie_draft_name', draftName); }, [draftName]);
  useEffect(() => { localStorage.setItem('trippie_trip_start_date', tripStartDate); }, [tripStartDate]);
  useEffect(() => { localStorage.setItem('trippie_trip_end_date', tripEndDate); }, [tripEndDate]);
  useEffect(() => { 
      if (taxRule) localStorage.setItem('trippie_tax_rule', JSON.stringify(taxRule)); 
      else localStorage.removeItem('trippie_tax_rule');
  }, [taxRule]);
  
  useEffect(() => {
    if (currentLoadedTripId) {
        localStorage.setItem('trippie_current_trip_id', currentLoadedTripId);
    } else {
        localStorage.removeItem('trippie_current_trip_id');
    }
  }, [currentLoadedTripId]);

  // Toast Timer
  useEffect(() => {
    if (toast) {
        const timer = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
      setToast({ msg, type });
  };

  // Helper to determine active trip name
  const currentTripName = currentLoadedTripId 
      ? tripHistory.find(t => t.id === currentLoadedTripId)?.name || ''
      : draftName;

  // --- Handlers ---
  const handleNameChange = (newName: string) => {
      if (currentLoadedTripId) {
          // Update historical trip name immediately
          setTripHistory(prev => prev.map(t => t.id === currentLoadedTripId ? { ...t, name: newName } : t));
      } else {
          // Update draft name
          setDraftName(newName);
      }
  };

  // Logic for renaming from bookshelf
  const handleRenameFromBookshelf = (id: string | null, newName: string) => {
      if (id === null) {
          // It's the draft
          setDraftName(newName);
      } else {
          // It's a historical trip
          setTripHistory(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));
      }
      showToast('已更新旅程名稱');
  };

  const handleSaveCountry = async (country: string) => {
    if (country === travelCountry && taxRule) {
        setIsCountryModalOpen(false);
        return;
    }
    
    setTravelCountry(country);
    setIsFetchingTaxRule(true);
    setTaxRule(null); // Clear old rule to avoid confusion
    
    try {
        const rule = await fetchTaxRefundRules(country);
        if (rule) {
            setTaxRule(rule);
            showToast(`已更新：${rule.country} 退稅門檻 ${rule.minSpend} ${rule.currency}`);
            setIsCountryModalOpen(false);
        } else {
            showToast("查無此國家的退稅資訊，請確認名稱是否正確", "error");
        }
    } catch (e) {
        showToast("連線錯誤，請稍後再試", "error");
    } finally {
        setIsFetchingTaxRule(false);
    }
  };

  const handleAddCompanion = (name: string) => {
    const newCompanion = { id: generateId(), name };
    setCompanions(prev => [...prev, newCompanion]);
    showToast(`已新增旅伴：${name}`);
  };

  const handleRemoveCompanion = (id: string) => {
    setCompanions(prev => prev.filter(c => c.id !== id));
    showToast("已移除旅伴", "error");
  };

  const handleAddShoppingItem = (name: string) => {
      const effectivePhase = currentPhase === 'summary' ? 'post' : currentPhase;
      setShoppingList(prev => [...prev, { 
          id: generateId(), 
          name, 
          isPurchased: false,
          phase: effectivePhase
      }]);
      showToast("已新增購物清單項目");
  };

  const handleRemoveShoppingItem = (id: string) => {
      setShoppingList(prev => prev.filter(item => item.id !== id));
  };

  const handlePurchaseShoppingItem = (item: ShoppingItem) => {
      // Default category based on phase logic (assuming item.phase matches context)
      let defaultCat = Category.SHOPPING;
      if (item.phase === 'pre') defaultCat = Category.SHOPPING_PRE;
      if (item.phase === 'post') defaultCat = Category.SOUVENIR;

      setInitialFormCategory(defaultCat);
      setInitialFormDescription(item.name);
      setFormLinkedItemId(item.id);
      setIsFormOpen(true);
  };

  const handleSaveExpense = (data: Omit<Expense, 'id'>, linkedItemId?: string) => {
    if (editingExpense) {
        setExpenses(prev => prev.map(e => e.id === editingExpense.id ? { ...data, id: e.id } : e));
    } else {
        const expense: Expense = { ...data, id: generateId() };
        setExpenses(prev => [...prev, expense]);
        
        if (linkedItemId) {
            setShoppingList(prev => prev.map(item => 
                item.id === linkedItemId ? { ...item, isPurchased: true } : item
            ));
        }
        
        // Custom toast for auto-creation
        if (data.needsReview) {
            showToast("已建立支出，但部分內容可能需要確認", "error");
        } else if (!editingExpense) {
            // Standard create
            showToast("已新增支出");
        }
    }
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    showToast("已刪除該筆支出", "error");
  };

  const handleEditExpense = (expense: Expense) => {
      setEditingExpense(expense);
      setIsFormOpen(true);
  };

  const handleArchiveTrip = (name: string, totalCost: number) => {
    try {
        // Use explicit trip dates if available, otherwise calculate from expenses
        let start = tripStartDate;
        let end = tripEndDate;
        
        if (!start || !end) {
            const range = getExpenseDateRange(expenses);
            start = range.start;
            end = range.end;
        }

        const newTrip: Trip = {
            id: generateId(),
            name,
            startDate: start,
            endDate: end,
            expenses: [...expenses], 
            companions: [...companions],
            shoppingList: [...shoppingList],
            totalCost,
            archivedAt: new Date().toISOString(),
            taxRule: taxRule || undefined // Persist tax rule
        };

        setTripHistory(prev => [newTrip, ...prev]);
        setExpenses([]); 
        setCompanions([]); 
        setShoppingList([]);
        setCurrentLoadedTripId(null); 
        setDraftName(''); // Clear draft name
        setTripStartDate('');
        setTripEndDate('');
        setCurrentPhase('pre'); 
        setTravelCountry('');
        setTaxRule(null);
        
        showToast("旅程已成功封存！");
        setViewMode('bookshelf'); // Go back to shelf
    } catch (e) {
        console.error(e);
        showToast("封存失敗，請稍後再試", "error");
    }
  };

  const handleRestoreTrip = (trip: Trip) => {
    // If there is active data that hasn't been archived, warn user? 
    if (expenses.length > 0 && !currentLoadedTripId) {
        const confirmSwitch = window.confirm("您目前有正在編輯但未封存的草稿，切換旅程將會覆蓋它。確定要繼續嗎？");
        if (!confirmSwitch) return;
    }

    setExpenses(trip.expenses);
    setCompanions(trip.companions || []);
    setShoppingList(trip.shoppingList || []);
    setCurrentLoadedTripId(trip.id); 
    setTripStartDate(trip.startDate);
    setTripEndDate(trip.endDate);
    
    // Restore Tax Rule
    if (trip.taxRule) {
        setTaxRule(trip.taxRule);
        setTravelCountry(trip.taxRule.country);
    } else {
        setTaxRule(null);
        setTravelCountry('');
    }
    
    // Determine start phase based on data
    const hasPost = trip.expenses.some(e => e.phase === 'post');
    const hasDuring = trip.expenses.some(e => e.phase === 'during');
    
    if (hasPost) { setCurrentPhase('post'); } 
    else if (hasDuring) { setCurrentPhase('during'); } 
    else { setCurrentPhase('pre'); }
    
    setViewMode('trip');
    showToast(`已打開：${trip.name}`);
  };

  const handleOpenDraft = () => {
      setViewMode('trip');
  };

  const handleCreateNewTrip = () => {
      if (expenses.length > 0) {
           const confirmNew = window.confirm("您目前有正在編輯的草稿，建立新旅程將會清空它。確定要繼續嗎？");
           if (!confirmNew) return;
      }
      
      setExpenses([]);
      setCompanions([]);
      setShoppingList([]);
      setCurrentLoadedTripId(null);
      setDraftName(''); // Clear draft name
      setTripStartDate('');
      setTripEndDate('');
      setCurrentPhase('pre');
      setTravelCountry('');
      setTaxRule(null);
      
      setViewMode('trip');
      showToast("新旅程已開啟，開始記帳吧！");
  };

  const handleDeleteHistory = (id: string) => {
      if (window.confirm("確定要刪除這本旅程紀錄嗎？此動作無法復原。")) {
        setTripHistory(prev => prev.filter(t => t.id !== id));
        showToast("已刪除旅程紀錄", "error");
      }
  };

  // Helper to get exchange rate synchronously
  const getRateForAutoSave = (currencyCode: string, paymentMethod: PaymentMethod, currentExpenses: Expense[]) => {
      if (currencyCode === 'TWD') return 1;
      
      if (paymentMethod === PaymentMethod.CASH_FOREIGN) {
          const exchanges = currentExpenses.filter(e => e.category === Category.EXCHANGE && e.currency === currencyCode);
          if (exchanges.length > 0) {
              const totalForeign = exchanges.reduce((acc, curr) => acc + curr.amount, 0);
              const totalCostTwd = exchanges.reduce((acc, curr) => acc + curr.twdAmount, 0);
              if (totalForeign > 0) return totalCostTwd / totalForeign;
          }
      }
      
      const target = COMMON_CURRENCIES.find(c => c.code === currencyCode);
      return target ? target.defaultRate : 1;
  };

  // Smart Scan Handler Logic
  const handleSmartScan = async (file: File) => {
    // 1. Convert to Base64
    const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

    try {
        const base64String = await toBase64(file);
        const base64Data = base64String.split(',')[1];
        
        // 2. Call AI
        const result = await parseImageExpenseWithGemini(base64Data, file.type);
        
        if (!result || !result.amount) {
            showToast("AI 無法辨識金額，請稍後再試", "error");
            return;
        }

        const parsedAmount = result.amount;
        const parsedCurrency = result.currency?.toUpperCase() || 'TWD';
        const parsedCategory = (Object.values(Category).find(c => c === result.category) as Category) || Category.OTHER;
        const parsedPayment = (Object.values(PaymentMethod).find(p => p === result.paymentMethod) as PaymentMethod) || PaymentMethod.CASH_TWD;
        const parsedDate = result.date || new Date().toISOString().split('T')[0];
        const parsedCountry = result.country; // Extracted country from image

        // Determine phase based on category for new trips
        let inferredPhase: Phase = 'during';
        if (CATEGORIES_BY_PHASE.pre.includes(parsedCategory)) inferredPhase = 'pre';
        if (CATEGORIES_BY_PHASE.post.includes(parsedCategory)) inferredPhase = 'post';

        // 3. Routing Logic
        const matchedTrip = tripHistory.find(trip => {
            if (trip.expenses.length === 0) return false;
            // Use Trip explicit dates first, then expense fallback
            const start = trip.startDate;
            const end = trip.endDate;
            return parsedDate >= start && parsedDate <= end;
        });

        const newExpenseId = generateId();
        
        if (matchedTrip) {
            // SCENARIO A: Found existing trip in history -> Restore and Add
            const activeExpenses = migrateExpenses(matchedTrip.expenses);
            
            // Calc rate based on that trip's history
            const rate = getRateForAutoSave(parsedCurrency, parsedPayment, activeExpenses);
            const newExpense: Expense = {
                id: newExpenseId,
                description: result.description || '智慧匯入項目',
                amount: parsedAmount,
                currency: parsedCurrency,
                exchangeRate: rate,
                twdAmount: parsedAmount * rate,
                category: parsedCategory,
                paymentMethod: parsedPayment,
                phase: inferredPhase, 
                date: parsedDate,
                payerId: 'me',
                beneficiaries: ['me'],
                splitMethod: 'EQUAL',
                splitAllocations: {},
                handlingFee: 0,
                needsReview: result.isUncertain
            };
            
            setExpenses([...activeExpenses, newExpense]);
            setCompanions(matchedTrip.companions || []);
            setShoppingList(matchedTrip.shoppingList ? migrateShoppingList(matchedTrip.shoppingList) : []);
            setCurrentLoadedTripId(matchedTrip.id);
            setTripStartDate(matchedTrip.startDate);
            setTripEndDate(matchedTrip.endDate);
            setTaxRule(matchedTrip.taxRule || null);
            setTravelCountry(matchedTrip.taxRule?.country || '');
            setCurrentPhase(inferredPhase);
            setViewMode('trip');
            
            showToast(`已歸檔至「${matchedTrip.name}」並還原帳本`);

        } else if (expenses.length > 0) {
             // SCENARIO B: Draft is open. 
             // If draft doesn't have a country set yet, and AI found one, set it automatically.
             if (!travelCountry && parsedCountry) {
                 setTravelCountry(parsedCountry);
                 showToast(`已自動偵測國家：${parsedCountry}`);
                 // Fetch tax rule immediately
                 fetchTaxRefundRules(parsedCountry).then(rule => {
                     if (rule) {
                         setTaxRule(rule);
                         showToast(`已自動套用 ${parsedCountry} 退稅規則`);
                     }
                 });
             }

             // Update Trip Dates if AI found explicit Travel Range (e.g. from Flight ticket)
             if (result.travelStartDate && result.travelEndDate) {
                 setTripStartDate(result.travelStartDate);
                 setTripEndDate(result.travelEndDate);
                 showToast(`已更新旅遊日期：${result.travelStartDate} ~ ${result.travelEndDate}`);
             }

             const rate = getRateForAutoSave(parsedCurrency, parsedPayment, expenses);
             const newExpense: Expense = {
                id: newExpenseId,
                description: result.description || '智慧匯入項目',
                amount: parsedAmount,
                currency: parsedCurrency,
                exchangeRate: rate,
                twdAmount: parsedAmount * rate,
                category: parsedCategory,
                paymentMethod: parsedPayment,
                phase: inferredPhase,
                date: parsedDate,
                payerId: 'me',
                beneficiaries: ['me', ...companions.map(c => c.id)],
                splitMethod: 'EQUAL',
                splitAllocations: {},
                handlingFee: 0,
                needsReview: result.isUncertain
            };

            setExpenses(prev => [...prev, newExpense]);
            setCurrentPhase(inferredPhase);
            setViewMode('trip');
            showToast("已加入目前草稿");

        } else {
            // SCENARIO C: No match, no draft -> Create NEW TRIP
            const rate = getRateForAutoSave(parsedCurrency, parsedPayment, []);
            const newExpense: Expense = {
                id: newExpenseId,
                description: result.description || '智慧匯入項目',
                amount: parsedAmount,
                currency: parsedCurrency,
                exchangeRate: rate,
                twdAmount: parsedAmount * rate,
                category: parsedCategory,
                paymentMethod: parsedPayment,
                phase: inferredPhase,
                date: parsedDate,
                payerId: 'me',
                beneficiaries: ['me'],
                splitMethod: 'EQUAL',
                splitAllocations: {},
                handlingFee: 0,
                needsReview: result.isUncertain
            };

            // Reset Context
            setExpenses([newExpense]);
            setCompanions([]);
            setShoppingList([]);
            setCurrentLoadedTripId(null);
            
            // Auto Set Dates from AI if available, otherwise undefined (will fallback to expense date later)
            if (result.travelStartDate && result.travelEndDate) {
                setTripStartDate(result.travelStartDate);
                setTripEndDate(result.travelEndDate);
            } else {
                setTripStartDate('');
                setTripEndDate('');
            }
            
            // Set a smart default name for the new trip
            setDraftName(`${parsedDate} ${parsedCountry ? parsedCountry + ' ' : ''}新旅程`);
            
            // Auto Set Country & Fetch Tax Rule
            if (parsedCountry) {
                setTravelCountry(parsedCountry);
                fetchTaxRefundRules(parsedCountry).then(rule => {
                     if (rule) {
                         setTaxRule(rule);
                         showToast(`已自動套用 ${parsedCountry} 退稅規則`);
                     }
                });
            } else {
                setTaxRule(null);
                setTravelCountry('');
            }
            
            setCurrentPhase(inferredPhase);
            setViewMode('trip');
            showToast(`已為您建立新旅程`);
        }

    } catch (e) {
        console.error(e);
        showToast("圖片識別失敗", "error");
    }
  };

  const handleExport = () => {
    const headers = ['日期', '階段', '分類', '付款方式', '項目', '原幣金額', '幣別', '匯率', '手續費(TWD)', '總台幣金額', '付款人', '分攤人/分帳詳情'];
    const csvContent = [
        headers.join(','),
        ...expenses.map(e => {
            const payerName = e.payerId === 'me' ? '我' : companions.find(c => c.id === e.payerId)?.name || '未知';
            let beneficiaryInfo = '';
            
            if (e.splitMethod === 'EQUAL') {
                beneficiaryInfo = e.beneficiaries.map(id => id === 'me' ? '我' : companions.find(c => c.id === id)?.name || '').join(';');
            } else {
                beneficiaryInfo = Object.entries(e.splitAllocations)
                    .map(([id, amount]) => {
                        const name = id === 'me' ? '我' : companions.find(c => c.id === id)?.name || '未知';
                        return `${name}:$${Math.round(amount as number)}`;
                    })
                    .join(';');
            }

            return [
                e.date,
                e.phase === 'pre' ? '旅行前' : e.phase === 'during' ? '旅行中' : '回國機場消費',
                e.category,
                e.paymentMethod,
                `"${e.description}"`,
                e.amount,
                e.currency,
                e.exchangeRate,
                e.handlingFee || 0,
                e.twdAmount,
                payerName,
                `"${beneficiaryInfo}"`
            ].join(',')
        })
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Trippie_Expenses_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const handleQuickAdd = (category: Category) => {
    setInitialFormCategory(category);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setTimeout(() => {
        setInitialFormCategory(undefined);
        setInitialFormDescription(undefined);
        setFormLinkedItemId(undefined);
        setEditingExpense(undefined);
    }, 300);
  };

  const filteredExpenses = expenses.filter(e => e.phase === currentPhase);

  // Dynamic Title for Shopping Panel
  let shoppingPanelTitle = '🛒 待買清單';
  if (currentPhase === 'pre') shoppingPanelTitle = '🛍️ 行前購物清單';
  if (currentPhase === 'post') shoppingPanelTitle = '🎁 免稅/機場待買清單';

  // --- RENDER ---

  // 1. Bookshelf View
  if (viewMode === 'bookshelf') {
      // Calculate display dates: Prefer explicit trip dates, fallback to expense range
      let displayStart = tripStartDate;
      let displayEnd = tripEndDate;
      
      if (!displayStart || !displayEnd) {
          const { start, end } = getExpenseDateRange(expenses);
          displayStart = start;
          displayEnd = end;
      }
      
      return (
          <>
            <TripSelectionScreen 
                currentDraftExpenses={expenses}
                draftName={draftName} // Pass Draft Name
                draftStartDate={displayStart}
                draftEndDate={displayEnd}
                tripHistory={tripHistory}
                onOpenDraft={handleOpenDraft}
                onOpenTrip={handleRestoreTrip}
                onCreateNew={handleCreateNewTrip}
                onDeleteTrip={handleDeleteHistory}
                onRenameTrip={handleRenameFromBookshelf} // Pass Rename Handler
                onSmartScan={handleSmartScan}
            />
            {/* Toast Notification (Global) */}
            {toast && (
                <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg z-[60] flex items-center gap-2 text-sm font-bold animate-fade-in-down ${
                    toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'
                }`}>
                    {toast.type === 'error' ? <Trash2 size={16} className="text-white" /> : <CheckCircle size={16} className="text-emerald-400" />}
                    {toast.msg}
                </div>
            )}
          </>
      );
  }

  // 2. Trip Detail View
  // Logic to show date in header
  let headerStart = tripStartDate;
  let headerEnd = tripEndDate;
  if (!headerStart || !headerEnd) {
      const { start, end } = getExpenseDateRange(expenses);
      headerStart = start;
      headerEnd = end;
  }
  const tripDateRangeDisplay = formatDateRange(headerStart, headerEnd);

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-gray-50 flex flex-col relative shadow-2xl border-x border-gray-100">
      
      {/* Toast Notification */}
      {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg z-[60] flex items-center gap-2 text-sm font-bold animate-fade-in-down ${
              toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'
          }`}>
              {toast.type === 'error' ? <Trash2 size={16} className="text-white" /> : <CheckCircle size={16} className="text-emerald-400" />}
              {toast.msg}
          </div>
      )}

      {/* Header */}
      <header className="bg-white pt-8 pb-4 px-6 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 w-full">
                <button 
                    onClick={() => setViewMode('bookshelf')}
                    className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors flex-shrink-0"
                    title="回到書架"
                >
                    <ArrowLeft size={24} />
                </button>
                
                {/* Editable Trip Name & Date Range */}
                <div className="flex-1 min-w-0 mx-2">
                    <input 
                        type="text"
                        value={currentTripName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="點擊命名旅程..."
                        className="text-xl font-black text-brand-900 tracking-tight bg-transparent border-b border-transparent hover:border-gray-300 focus:border-brand-500 outline-none w-full transition-all placeholder:text-gray-300"
                    />
                    {(expenses.length > 0 || tripStartDate) && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 font-bold mt-1 ml-0.5">
                            <CalendarDays size={12} />
                            {tripDateRangeDisplay}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    <button 
                        onClick={() => setIsCountryModalOpen(true)}
                        className={`p-2.5 rounded-full transition-colors flex items-center justify-center border-2 ${travelCountry ? 'bg-brand-50 border-brand-200 text-brand-600' : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'}`}
                        title="設定旅遊國家"
                    >
                        <Globe size={20} />
                    </button>
                    <button 
                        onClick={() => setIsCompanionsOpen(true)}
                        className={`p-2.5 rounded-full transition-colors relative flex items-center justify-center ${companions.length > 0 ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:bg-gray-100'}`}
                        title="旅伴管理"
                    >
                        <Users size={20} />
                        {companions.length > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></span>}
                    </button>
                </div>
            </div>
        </div>
        <PhaseSelector currentPhase={currentPhase} onChange={setCurrentPhase} />
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        
        {currentPhase === 'summary' ? (
           /* Full Screen Summary View */
           <TripSummaryModal 
                expenses={expenses}
                onArchive={handleArchiveTrip}
                taxRule={taxRule}
                variant="embedded"
                initialTripName={currentTripName} // Pass current name to summary
           />
        ) : (
           /* Standard Phase Views */
           <>
              <Dashboard 
                  expenses={expenses} 
                  companions={companions}
                  onExport={handleExport}
                  onAddCash={() => handleQuickAdd(Category.EXCHANGE)}
                  onAddExpense={handleSaveExpense}
                  currentPhase={currentPhase}
                  taxRule={taxRule}
              />
              
              {/* Pre-trip Category Shortcuts */}
              {currentPhase === 'pre' && (
                <PreTripChecklist 
                    onQuickAddCategory={handleQuickAdd} 
                    expenses={expenses}
                />
              )}

              {/* Post-trip/Airport Category Shortcuts (NEW) */}
              {currentPhase === 'post' && (
                <PostTripChecklist 
                    onQuickAddCategory={handleQuickAdd} 
                    expenses={expenses}
                />
              )}

              {/* Shared Shopping List Panel (Enabled for Pre, During, and Post) */}
              {currentPhase !== 'summary' && (
                  <ShoppingListPanel 
                      title={shoppingPanelTitle}
                      shoppingList={shoppingList.filter(item => item.phase === currentPhase)}
                      onAddItem={handleAddShoppingItem}
                      onRemoveItem={handleRemoveShoppingItem}
                      onPurchaseItem={handlePurchaseShoppingItem}
                  />
              )}

              <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="font-bold text-gray-700">
                      {currentPhase === 'pre' && '行前準備清單'}
                      {currentPhase === 'during' && '旅途消費紀錄'}
                      {currentPhase === 'post' && '回國機場消費'}
                  </h3>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                      共 {filteredExpenses.length} 筆
                  </span>
              </div>

              <ExpenseList 
                  expenses={filteredExpenses} 
                  onDelete={handleDeleteExpense} 
                  onEdit={handleEditExpense} 
                  taxRule={taxRule}
              />
           </>
        )}
      </main>

      {/* Floating Action Button (Only show if NOT in summary) */}
      {currentPhase !== 'summary' && (
        <div className="fixed bottom-6 right-6 z-40 md:absolute md:right-6 md:bottom-6">
            <button
            onClick={() => setIsFormOpen(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white p-4 rounded-full shadow-lg shadow-brand-500/30 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
            >
            <Plus size={28} />
            </button>
        </div>
      )}

      {/* Expense Modal */}
      {isFormOpen && (
        <ExpenseForm 
            currentPhase={currentPhase === 'summary' ? 'post' : currentPhase} // Fallback to post if somehow opened in summary
            existingExpenses={expenses}
            companions={companions}
            initialCategory={initialFormCategory}
            initialDescription={initialFormDescription}
            linkedItemId={formLinkedItemId}
            initialData={editingExpense}
            taxRule={taxRule}
            onSubmit={handleSaveExpense} 
            onClose={handleCloseForm} 
        />
      )}

      {/* Companions Modal */}
      {isCompanionsOpen && (
          <CompanionsModal 
            companions={companions}
            onAdd={handleAddCompanion}
            onRemove={handleRemoveCompanion}
            onClose={() => setIsCompanionsOpen(false)}
          />
      )}

      {/* Country Settings Modal */}
      {isCountryModalOpen && (
          <CountrySettingsModal 
            initialCountry={travelCountry}
            onSave={handleSaveCountry}
            onClose={() => setIsCountryModalOpen(false)}
            isLoading={isFetchingTaxRule}
          />
      )}
    </div>
  );
};

export default App;
