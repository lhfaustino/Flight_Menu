'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentMealPlanVersion, refreshCurrentUserMealPlan, uploadRoster } from '@/app/actions/roster-upload';
import { sendTodayFlightInformation } from '@/app/actions/telegram';
import { RosterUploadCard } from '@/components/features/roster/RosterUploadCard';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog, Modal, ModalOverlay } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { RefreshCw, Send } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';

type FlightMenuRow = {
  id: string;
  date: string;
  flightNumber: string;
  origin: string;
  destination: string;
  crewService: string;
  paxService: string;
};

interface FlightMenuUploadWorkspaceProps {
  currentMealPlanUpdatedAt?: string | null;
  currentUserId?: string | null;
  initialRows?: FlightMenuRow[];
}

export function FlightMenuUploadWorkspace({
  currentMealPlanUpdatedAt = null,
  currentUserId = null,
  initialRows = [],
}: FlightMenuUploadWorkspaceProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshingMealPlan, setIsRefreshingMealPlan] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [latestMealPlanUpdatedAt, setLatestMealPlanUpdatedAt] = useState<string | null>(currentMealPlanUpdatedAt);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rows, setRows] = useState<FlightMenuRow[]>(initialRows);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [todayIso, setTodayIso] = useState('');
  const visibleRows = todayIso ? rows.filter((row) => isTodayOrFuture(row.date, todayIso)) : rows;
  const visibleRowIds = visibleRows.map((row) => row.id);
  const selectedVisibleRowCount = visibleRowIds.filter((id) => selectedRowIds.includes(id)).length;
  const areAllVisibleRowsSelected = visibleRows.length > 0 && selectedVisibleRowCount === visibleRows.length;
  const areSomeVisibleRowsSelected = selectedVisibleRowCount > 0 && selectedVisibleRowCount < visibleRows.length;
  const mealPlanStorageKey = currentUserId ? `flight-menu:meal-plan-refresh:${currentUserId}` : null;
  const mealPlanToastStorageKey = currentUserId ? `flight-menu:meal-plan-toast:${currentUserId}` : null;

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    const rowIds = new Set(rows.map((row) => row.id));
    setSelectedRowIds((currentIds) => currentIds.filter((id) => rowIds.has(id)));
  }, [rows]);

  useEffect(() => {
    setLatestMealPlanUpdatedAt(currentMealPlanUpdatedAt);
  }, [currentMealPlanUpdatedAt]);

  useEffect(() => {
    setTodayIso(getTodayIsoDate());
  }, []);

  useEffect(() => {
    if (!mealPlanStorageKey || !mealPlanToastStorageKey || !latestMealPlanUpdatedAt) {
      return;
    }

    const lastAppliedMealPlan = window.localStorage.getItem(mealPlanStorageKey);
    if (lastAppliedMealPlan === latestMealPlanUpdatedAt) {
      return;
    }

    const lastNotifiedMealPlan = window.sessionStorage.getItem(mealPlanToastStorageKey);
    if (lastNotifiedMealPlan === latestMealPlanUpdatedAt) {
      return;
    }

    window.sessionStorage.setItem(mealPlanToastStorageKey, latestMealPlanUpdatedAt);
    addToast({
      title: 'Novo meal plan disponivel',
      description: 'Clique em Atualizar para aplicar os novos servicos aos seus voos.',
      type: 'warning',
      duration: 0,
      dedupeKey: `meal-plan-refresh:${currentUserId}:${latestMealPlanUpdatedAt}`,
    });
  }, [addToast, latestMealPlanUpdatedAt, mealPlanStorageKey, mealPlanToastStorageKey]);

  useEffect(() => {
    const intervalId = window.setInterval(async () => {
      const result = await getCurrentMealPlanVersion();
      if (result.success && result.mealPlanUpdatedAt) {
        setLatestMealPlanUpdatedAt(result.mealPlanUpdatedAt);
      }
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleUpdate = async () => {
    if (!rosterFile) {
      setMessage({ type: 'error', text: 'Selecione o PDF da escala antes de atualizar.' });
      return;
    }

    setIsUpdating(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', rosterFile);

      const result = await uploadRoster(formData);

      if (result.success) {
        setRows(result.rows ?? rows);
        setMessage({ type: 'success', text: result.message ?? 'Escala atualizada.' });
        const mealPlanVersion = await getCurrentMealPlanVersion();
        if (mealPlanStorageKey && mealPlanVersion.success && mealPlanVersion.mealPlanUpdatedAt) {
          window.localStorage.setItem(mealPlanStorageKey, mealPlanVersion.mealPlanUpdatedAt);
          if (mealPlanToastStorageKey) {
            window.sessionStorage.setItem(mealPlanToastStorageKey, mealPlanVersion.mealPlanUpdatedAt);
          }
          setLatestMealPlanUpdatedAt(mealPlanVersion.mealPlanUpdatedAt);
        }
        setIsUploadOpen(false);
        router.refresh();
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Não foi possível atualizar a escala.' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível atualizar a escala.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendTodayInformation = async () => {
    if (selectedRowIds.length === 0) {
      setMessage({ type: 'error', text: 'Selecione ao menos um voo para enviar.' });
      return;
    }

    setIsSendingTelegram(true);
    setMessage(null);

    try {
      const result = await sendTodayFlightInformation(selectedRowIds);

      if (result.success) {
        setMessage({ type: 'success', text: result.message ?? 'Voos enviados pelo Telegram.' });
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Não foi possível enviar pelo Telegram.' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível enviar pelo Telegram.',
      });
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const toggleRowSelection = (rowId: string, isSelected: boolean) => {
    setSelectedRowIds((currentIds) => {
      if (isSelected) {
        return currentIds.includes(rowId) ? currentIds : [...currentIds, rowId];
      }

      return currentIds.filter((id) => id !== rowId);
    });
  };

  const toggleAllVisibleRows = (isSelected: boolean) => {
    setSelectedRowIds((currentIds) => {
      const visibleIds = new Set(visibleRowIds);

      if (!isSelected) {
        return currentIds.filter((id) => !visibleIds.has(id));
      }

      return [...new Set([...currentIds, ...visibleRowIds])];
    });
  };

  const handleRefreshMealPlan = async () => {
    setIsRefreshingMealPlan(true);
    setMessage(null);

    try {
      const result = await refreshCurrentUserMealPlan();

      if (result.success) {
        setRows(result.rows ?? rows);
        setMessage({ type: 'success', text: result.message ?? 'Servicos atualizados.' });
        if (mealPlanStorageKey && result.mealPlanUpdatedAt) {
          window.localStorage.setItem(mealPlanStorageKey, result.mealPlanUpdatedAt);
          if (mealPlanToastStorageKey) {
            window.sessionStorage.setItem(mealPlanToastStorageKey, result.mealPlanUpdatedAt);
          }
          setLatestMealPlanUpdatedAt(result.mealPlanUpdatedAt);
        }
        router.refresh();
      } else {
        setRows(result.rows ?? rows);
        setMessage({ type: 'error', text: result.error ?? 'Não foi possível atualizar os serviços.' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível atualizar os serviços.',
      });
    } finally {
      setIsRefreshingMealPlan(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        {message && (
          <div
            className={`rounded-lg px-4 py-3 text-sm sm:flex-1 ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}
        <Button
          variant="secondary"
          onPress={handleRefreshMealPlan}
          isDisabled={isRefreshingMealPlan}
          className="w-full sm:w-auto"
          size="lg"
          iconLeading={RefreshCw}
        >
          {isRefreshingMealPlan ? 'Atualizando...' : 'Atualizar'}
        </Button>
        <Button
          variant="secondary"
          onPress={handleSendTodayInformation}
          isDisabled={isSendingTelegram || selectedRowIds.length === 0}
          className="w-full sm:w-auto"
          size="lg"
          iconLeading={Send}
        >
          {isSendingTelegram ? 'Enviando...' : 'Enviar'}
        </Button>
        <Button
          onPress={() => {
            setMessage(null);
            setIsUploadOpen(true);
          }}
          className="w-full sm:w-auto"
          size="lg"
        >
          Enviar Escala
        </Button>
      </div>

      <ModalOverlay isOpen={isUploadOpen} onOpenChange={setIsUploadOpen} isDismissable>
        <Modal className="sm:max-w-5xl">
          <Dialog className="outline-none">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Enviar Escala</h2>
              <p className="mt-1 text-sm text-gray-500">
                Envie seu arquivo de escala. A planilha de alimentação fixa será aplicada automaticamente.
              </p>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-4 py-5 sm:px-6">
              <div className="grid grid-cols-1 gap-6">
                <RosterUploadCard deferUpload onFileSelected={setRosterFile} />
              </div>

              {message && (
                <div
                  className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                    message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  {message.text}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onPress={() => setIsUploadOpen(false)}
                isDisabled={isUpdating}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                onPress={handleUpdate}
                isDisabled={!rosterFile || isUpdating}
                className="w-full sm:w-auto"
              >
                {isUpdating ? 'Enviando...' : 'Atualizar'}
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Serviços</h2>
          <p className="mt-1 text-sm text-gray-500">
            {visibleRows.length === 0
              ? 'Envie sua escala para carregar seus voos e aplicar os serviços de bordo disponíveis.'
              : `${visibleRows.length} ${visibleRows.length === 1 ? 'voo' : 'voos'}${selectedRowIds.length > 0 ? `, ${selectedRowIds.length} selecionado${selectedRowIds.length === 1 ? '' : 's'}.` : '.'}`}
          </p>
        </div>

        {visibleRows.length > 0 ? (
          <Table>
            <TableHeader>
                <TableRow>
                  <TableHead className="h-9 w-10 px-3">
                    <Checkbox
                      aria-label="Selecionar todos os voos visiveis"
                      isDisabled={visibleRows.length === 0}
                      isIndeterminate={areSomeVisibleRowsSelected}
                      isSelected={areAllVisibleRowsSelected}
                      onChange={toggleAllVisibleRows}
                    />
                  </TableHead>
                  <TableHead className="h-9 px-3">Data</TableHead>
                  <TableHead className="h-9 px-3">Voo</TableHead>
                  <TableHead className="h-9 px-3">Origem</TableHead>
                  <TableHead className="h-9 px-3">Destino</TableHead>
                  <TableHead className="h-9 px-3">Serviço crew</TableHead>
                  <TableHead className="h-9 px-3">Serviço pax</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  className={todayIso && isToday(row.date, todayIso) ? 'bg-blue-50 hover:bg-blue-50' : undefined}
                >
                  <TableCell className="px-3 py-2">
                    <Checkbox
                      aria-label={`Selecionar voo ${row.flightNumber}`}
                      isSelected={selectedRowIds.includes(row.id)}
                      onChange={(isSelected) => toggleRowSelection(row.id, isSelected)}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 font-medium text-gray-900">{formatDate(row.date)}</TableCell>
                  <TableCell className="px-3 py-2">{row.flightNumber}</TableCell>
                  <TableCell className="px-3 py-2">{row.origin}</TableCell>
                  <TableCell className="px-3 py-2">{row.destination}</TableCell>
                  <TableCell className="px-3 py-2">{row.crewService}</TableCell>
                  <TableCell className="px-3 py-2">{row.paxService}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="px-6 py-10 text-sm text-gray-500">
            Seus voos e respectivos serviços aparecerão aqui.
          </div>
        )}
      </div>
    </div>
  );
}

function normalizeDate(value: string) {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return value;

  const brazilMatch = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (brazilMatch) return `${brazilMatch[3]}-${brazilMatch[2]}-${brazilMatch[1]}`;

  return value;
}

function formatDate(value: string) {
  const normalized = normalizeDate(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || '-';

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function isTodayOrFuture(value: string, today: string) {
  const rowDate = normalizeDate(value);

  return Boolean(rowDate) && rowDate >= today;
}

function isToday(value: string, today: string) {
  return normalizeDate(value) === today;
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
