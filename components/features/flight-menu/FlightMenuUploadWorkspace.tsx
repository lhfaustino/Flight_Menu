'use client';

import { useState } from 'react';
import { updateFlightMenu } from '@/app/actions/flight-menu-upload';
import { CateringUploadCard } from '@/components/features/catering/CateringUploadCard';
import { RosterUploadCard } from '@/components/features/roster/RosterUploadCard';
import { Button } from '@/components/ui/Button';
import { Dialog, Modal, ModalOverlay } from '@/components/ui/Modal';
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
  initialRows?: FlightMenuRow[];
}

export function FlightMenuUploadWorkspace({ initialRows = [] }: FlightMenuUploadWorkspaceProps) {
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const [cateringFile, setCateringFile] = useState<File | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rows, setRows] = useState<FlightMenuRow[]>(initialRows);
  const visibleRows = rows.filter((row) => isTodayOrFuture(row.date));
  const todayRowsCount = visibleRows.filter((row) => isToday(row.date)).length;

  const handleUpdate = async () => {
    if (!rosterFile || !cateringFile) {
      setMessage({ type: 'error', text: 'Select both PDFs before clicking Atualizar.' });
      return;
    }

    setIsUpdating(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('rosterFile', rosterFile);
      formData.append('cateringFile', cateringFile);

      const result = await updateFlightMenu(formData);

      if (result.success) {
        setRows(result.rows ?? []);
        setMessage({ type: 'success', text: result.message ?? 'Flight menu updated.' });
        setIsUploadOpen(false);
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Could not update flight menu.' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not update flight menu.',
      });
    } finally {
      setIsUpdating(false);
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
          onPress={() => {
            setMessage(null);
            setIsUploadOpen(true);
          }}
          className="w-full sm:w-auto"
          size="lg"
        >
          Enviar Arquivos
        </Button>
      </div>

      <ModalOverlay isOpen={isUploadOpen} onOpenChange={setIsUploadOpen} isDismissable>
        <Modal className="sm:max-w-5xl">
          <Dialog className="outline-none">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Enviar Arquivos</h2>
              <p className="mt-1 text-sm text-gray-500">
                Envie os arquivos de escala e planilha de alimentação em PDF.
              </p>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-4 py-5 sm:px-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <RosterUploadCard deferUpload onFileSelected={setRosterFile} />
                <CateringUploadCard deferUpload onFileSelected={setCateringFile} />
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
                isDisabled={!rosterFile || !cateringFile || isUpdating}
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
              ? 'Upload both PDFs, then click Atualizar to parse and save the flight menu.'
              : `${visibleRows.length} ${visibleRows.length === 1 ? 'voo' : 'voos'}${todayRowsCount > 0 ? `, ${todayRowsCount} hoje.` : '.'}`}
          </p>
        </div>

        {visibleRows.length > 0 ? (
          <Table>
            <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Flight</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Destiny</TableHead>
                  <TableHead>Service crew</TableHead>
                  <TableHead>Service pax</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  className={isToday(row.date) ? 'bg-blue-50 hover:bg-blue-50' : undefined}
                >
                  <TableCell className="font-medium text-gray-900">{formatDate(row.date)}</TableCell>
                  <TableCell>{row.flightNumber}</TableCell>
                  <TableCell>{row.origin}</TableCell>
                  <TableCell>{row.destination}</TableCell>
                  <TableCell>{row.crewService}</TableCell>
                  <TableCell>{row.paxService}</TableCell>
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

function isTodayOrFuture(value: string) {
  const rowDate = normalizeDate(value);
  const today = getTodayIsoDate();

  return Boolean(rowDate) && rowDate >= today;
}

function isToday(value: string) {
  return normalizeDate(value) === getTodayIsoDate();
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
