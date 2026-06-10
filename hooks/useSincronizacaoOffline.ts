'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createClient } from '@/lib/supabase/client';
import type { AppDispatch, RootState } from '@/store';
import { setDadosFeature, type DadosFeature } from '@/store/featureSlice';

export function useSincronizacaoOffline(tableName = 'sua_tabela') {
  const dispatch = useDispatch<AppDispatch>();
  const dadosLocais = useSelector((state: RootState) => state.feature.dados);

  useEffect(() => {
    let ativo = true;

    async function sincronizar() {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.log('Modo offline detectado. Usando dados locais do Redux.');
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase.from(tableName).select('*');

      if (!ativo) {
        return;
      }

      if (!error && data) {
        dispatch(setDadosFeature(data as DadosFeature));
      } else {
        console.log('Erro de rede ou Supabase indisponivel. Usando dados locais do Redux.');
      }
    }

    sincronizar();
    window.addEventListener('online', sincronizar);

    return () => {
      ativo = false;
      window.removeEventListener('online', sincronizar);
    };
  }, [dispatch, tableName]);

  return dadosLocais;
}
