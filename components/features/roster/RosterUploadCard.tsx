'use client';

import { useRef, useState } from 'react';
import { uploadRoster } from '@/app/actions/roster-upload';
import { Button } from '@/components/ui/Button';
import { AlertCircle, CheckCircle2, Upload, X } from 'lucide-react';

type ParsedRosterFlight = {
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  date?: string;
  crewPosition?: string;
  equipment?: string;
};

interface RosterUploadCardProps {
  onUploaded?: (flights: ParsedRosterFlight[]) => void;
  onFileSelected?: (file: File | null) => void;
  onFilesSelected?: (files: File[]) => void;
  deferUpload?: boolean;
}

export function RosterUploadCard({ onUploaded, onFileSelected, onFilesSelected, deferUpload = false }: RosterUploadCardProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setSelectedFiles = (selectedFiles: File[]) => {
    const pdfFiles = selectedFiles.filter((selectedFile) => selectedFile.type === 'application/pdf');

    if (pdfFiles.length !== selectedFiles.length) {
      setMessage({ type: 'error', text: 'Selecione apenas arquivos PDF' });
      return;
    }

    setFiles(pdfFiles);
    onFileSelected?.(pdfFiles[0] ?? null);
    onFilesSelected?.(pdfFiles);
    setMessage(null);
  };

  const clearFiles = () => {
    setFiles([]);
    onFileSelected?.(null);
    onFilesSelected?.([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      const result = await uploadRoster(formData);

      if (result.success) {
        setMessage({ type: 'success', text: result.message ?? 'Escala enviada com sucesso' });
        onUploaded?.(result.flights ?? []);
        clearFiles();
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Falha no envio' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Falha no envio',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md p-4">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Enviar escala</h3>

        <div
          className="mb-4 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-blue-500 hover:bg-blue-50"
          onDrop={(event) => {
            event.preventDefault();
            const droppedFiles = Array.from(event.dataTransfer.files);
            if (droppedFiles.length > 0) setSelectedFiles(droppedFiles);
          }}
          onDragOver={(event) => event.preventDefault()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(event) => {
              const selectedFiles = Array.from(event.target.files ?? []);
              if (selectedFiles.length > 0) setSelectedFiles(selectedFiles);
            }}
          />

          {files.length > 0 ? (
            <div className="space-y-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {files.length} {files.length === 1 ? 'arquivo selecionado' : 'arquivos selecionados'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {(files.reduce((total, file) => total + file.size, 0) / 1024).toFixed(2)} KB no total
                  </p>
                </div>
                <button onClick={clearFiles} className="rounded p-1 hover:bg-gray-100">
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {files.map((file) => (
                  <div key={`${file.name}-${file.lastModified}`} className="flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2">
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-medium text-blue-600 hover:underline"
              >
                Clique para enviar
              </button>
              <p className="mt-1 text-sm text-gray-500">ou arraste e solte um ou mais PDFs</p>
              <p className="mt-2 text-xs text-gray-500">PDFs de até 50MB cada</p>
            </div>
          )}
        </div>

        {message && (
          <div
            className={`mb-4 flex items-start gap-3 rounded-lg p-3 text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <p>{message.text}</p>
          </div>
        )}

        {!deferUpload && (
          <Button
            onPress={handleUpload}
            isDisabled={files.length === 0 || loading}
            className="w-full"
            size="lg"
          >
            {loading ? 'Enviando...' : files.length > 1 ? 'Enviar Escalas' : 'Enviar Escala'}
          </Button>
        )}
      </div>
    </div>
  );
}
