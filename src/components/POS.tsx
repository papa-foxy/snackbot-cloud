import { useState, useEffect } from 'react';
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard } from 'lucide-react';
import { cn } from '../utils/cn';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { useTaxConfig, calculateOrderTax } from '../hooks/useTaxConfig';

interface MenuItem {
  id: string;
  name: string;
  base_price: number;
  category_id: string;
  image_url: string | null;  
}

interface Category {
  id: string;
  name: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

export function POS() {
  const { themeColors } = useSettings();
  const { configs: taxConfigs } = useTaxConfig();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [taxContext, setTaxContext] = useState<{ itemOverrides: any[]; categoryRules: any[] }>({
    itemOverrides: [],
    categoryRules: [],
  });

  useEffect(() => {
    fetchMenu();
    fetchTaxData();
  }, []);

  const fetchTaxData = async () => {
    try {
      const [overridesRes, rulesRes] = await Promise.all([
        supabase.from('tax_item_override').select('*'),
        supabase.from('tax_category_rule').select('*'),
      ]);
      
      if (!overridesRes.error && !rulesRes.error) {
        setTaxContext({
          itemOverrides: overridesRes.data || [],
          categoryRules: rulesRes.data || [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch tax data', error);
    }
  };

  const fetchMenu = async () => {
    try {
      const [categoriesRes, itemsRes] = await Promise.all([
        supabase.from('menu_categories').select('*').order('sort_order'),
        supabase.from('menu').select('*').eq('is_available', true)
      ]);
      
      if (categoriesRes.error) throw categoriesRes.error;
      if (itemsRes.error) throw itemsRes.error;
      
      setCategories(categoriesRes.data || []);
      setMenuItems(itemsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch menu', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    
    try {
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      const subtotal = cart.reduce((sum, item) => sum + (item.base_price * item.quantity), 0);
      
      // Calculate tax using proper tax management system
      const orderItems = cart.map(item => ({
        menu_item_id: item.id,
        category_id: item.category_id,
        subtotal: item.base_price * item.quantity,
      }));
      
      const taxResult = calculateOrderTax(orderItems, {
        configs: taxConfigs,
        itemOverrides: taxContext.itemOverrides,
        categoryRules: taxContext.categoryRules,
      });
      
      const total = taxResult.grand_total;
      const tax = total - subtotal;

      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          order_type: 'dine_in',
          status: 'pending',
          subtotal,
          tax,
          total
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const insertItems = cart.map(item => ({
        order_id: orderData.id,
        menu_id: item.id,
        quantity: item.quantity,
        unit_price: item.base_price,
        subtotal: item.base_price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(insertItems);

      if (itemsError) throw itemsError;

      setCart([]);
      alert('Order placed successfully!');
    } catch (error) {
      console.error('Failed to place order', error);
      alert('Failed to place order. Please try again.');
    }
  };

  const filteredItems = activeCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.category_id === activeCategory);

  const subtotal = cart.reduce((sum, item) => sum + (item.base_price * item.quantity), 0);
  
  // Calculate tax using proper tax management system
  const orderItems = cart.map(item => ({
    menu_item_id: item.id,
    category_id: item.category_id,
    subtotal: item.base_price * item.quantity,
  }));
  
  const taxResult = calculateOrderTax(orderItems, {
    configs: taxConfigs,
    itemOverrides: taxContext.itemOverrides,
    categoryRules: taxContext.categoryRules,
  });
  
  const total = taxResult.grand_total;
  const tax = total - subtotal;

  if (loading) return <div className="p-8">Loading POS...</div>;

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-6">
      <div className="flex-1 flex flex-col bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-[var(--sb-border)] flex gap-4 overflow-x-auto">
          <button 
            onClick={() => setActiveCategory('all')}
            className={cn("px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors", activeCategory === 'all' ? `${themeColors.bg} text-white` : "bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 hover:bg-gray-200")}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn("px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors", activeCategory === cat.id ? `${themeColors.bg} text-white` : "bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 hover:bg-gray-200")}
            >
              {cat.name}
            </button>
          ))}
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map(item => (
              <button 
                key={item.id}
                onClick={() => addToCart(item)}
                className={cn("flex flex-col items-center justify-center p-4 border border-gray-200 dark:border-[var(--sb-border)] rounded-xl hover:shadow-md transition-all bg-gray-50 dark:bg-neutral-800/50 aspect-square", `hover:${themeColors.border}`)}
              >
                <div className="w-16 h-16 rounded-full mb-3 overflow-hidden bg-gray-200 flex items-center justify-center">
                  {item.image_url ? (
                    <img 
                      src={item.image_url} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to placeholder if image fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <span className={cn("text-xs text-gray-400 dark:text-neutral-500", item.image_url ? "hidden" : "")}>
                    No Image
                  </span>
                </div>
                <h3 className="font-medium text-gray-900 dark:text-neutral-100 text-center text-sm mb-1 line-clamp-2">{item.name}</h3>
                <p className={cn("font-bold", themeColors.text)}>RM {item.base_price.toFixed(2)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-96 bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-[var(--sb-border)]">
          <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100 flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2" />
            Current Order
          </h2>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-neutral-500">
              <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
              <p>Cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50 p-3 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-neutral-100 text-sm">{item.name}</h4>
                  <p className="text-gray-500 dark:text-neutral-500 text-xs">RM {item.base_price.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-lg">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:text-neutral-300"><Minus className="w-4 h-4" /></button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:text-neutral-300"><Plus className="w-4 h-4" /></button>
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-neutral-100 w-16 text-right">RM {(item.base_price * item.quantity).toFixed(2)}</p>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50 space-y-3">
          <div className="flex justify-between text-sm text-gray-600 dark:text-neutral-400">
            <span>Subtotal</span>
            <span>RM {subtotal.toFixed(2)}</span>
          </div>
          {taxResult.tax_lines.length > 0 ? (
            taxResult.tax_lines.map((line, idx) => (
              <div key={idx} className="flex justify-between text-sm text-gray-600 dark:text-neutral-400">
                <span>{line.name} ({line.rate}{line.type === 'fixed' ? ' RM' : '%'})</span>
                <span>{line.is_inclusive ? '—' : `RM ${line.amount.toFixed(2)}`}</span>
              </div>
            ))
          ) : (
            <div className="flex justify-between text-sm text-gray-600 dark:text-neutral-400">
              <span>Tax</span>
              <span>RM 0.00</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-neutral-100 pt-2 border-t border-gray-200 dark:border-[var(--sb-border)]">
            <span>Total</span>
            <span className={themeColors.text}>RM {total.toFixed(2)}</span>
          </div>
          <button 
            onClick={placeOrder}
            disabled={cart.length === 0}
            className={cn("w-full py-3 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4", themeColors.bg)}
          >
            <CreditCard className="w-5 h-5" />
            Charge RM {total.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
