import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export { useAuth };

export function useSupabase() {
  return supabase;
}

export function useUser() {
  const { user } = useAuth();
  return user;
}

export function useCollection(collectionName: string, userId?: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let query = supabase.from(collectionName).select('*');
        
        if (userId) {
          query = query.eq('userId', userId);
        }
        
        const { data, error } = await query;

        if (error) {
          console.error(`Error fetching ${collectionName}:`, error);
        } else {
          setData(data || []);
        }
      } catch (error) {
        console.error(`Error fetching ${collectionName}:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [collectionName, userId]);

  return { data, loading };
}