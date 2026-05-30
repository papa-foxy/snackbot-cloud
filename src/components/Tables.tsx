import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { supabase } from '../lib/supabase';

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  floor: string;
}

export function Tables() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('table_number');
      
      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      console.error('Failed to fetch tables', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('tables')
        .update({ status })
        .eq('id', id);
        
      if (error) throw error;
      fetchTables();
    } catch (error) {
      console.error('Failed to update status', error);
    }
  };

  if (loading) return <div className="p-8 text-gray-500 dark:text-neutral-400">Loading tables...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Table Management</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">Manage restaurant floor and table status.</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors">
          <Plus className="w-4 h-4 mr-2" />
          Add Table
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {tables.map(table => (
          <div 
            key={table.id} 
            className={cn(
              "relative p-6 rounded-2xl border-2 transition-all cursor-pointer hover:shadow-md flex flex-col items-center justify-center aspect-square",
              table.status === 'available' ? "border-emerald-200 bg-emerald-50 hover:border-emerald-300 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:hover:border-emerald-500/50" :
              table.status === 'occupied' ? "border-red-200 bg-red-50 hover:border-red-300 dark:border-red-500/30 dark:bg-red-950/30 dark:hover:border-red-500/50" :
              "border-amber-200 bg-amber-50 hover:border-amber-300 dark:border-amber-500/30 dark:bg-amber-950/30 dark:hover:border-amber-500/50"
            )}
          >
            <div className="absolute top-3 right-3 flex gap-1">
              <button className="p-1 text-gray-400 hover:text-gray-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"><Edit2 className="w-3 h-3" /></button>
            </div>
            
            <h3 className="text-3xl font-bold text-gray-900 dark:text-neutral-100 mb-2">{table.table_number}</h3>
            
            <div className="flex items-center text-gray-500 dark:text-neutral-400 text-sm mb-4">
              <Users className="w-4 h-4 mr-1" />
              {table.capacity} Seats
            </div>

            <select 
              value={table.status}
              onChange={(e) => updateStatus(table.id, e.target.value)}
              className={cn(
                "text-xs font-medium px-3 py-1.5 rounded-full border-0 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer transition-colors",
                table.status === 'available' ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300" :
                table.status === 'occupied' ? "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300" :
                "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
              )}
            >
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
