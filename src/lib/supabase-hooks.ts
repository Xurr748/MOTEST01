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
    if (!userId) return;

    const fetchData = async () => {
      const { data, error } = await supabase
        .from(collectionName)
        .select('*')
        .eq('userId', userId);

      if (error) {
        console.error('Error fetching data:', error);
      } else {
        setData(data || []);
      }
      setLoading(false);
    };

    fetchData();
  }, [collectionName, userId]);

  return { data, loading };
}