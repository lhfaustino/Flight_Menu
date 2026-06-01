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
};

interface RosterUploadCardProps {
  onUploaded?: (flights: ParsedRosterFlight[]) => void;
  onFileSelected?: (file: File | null) => void;
  deferUpload?: boolean;
}

export function RosterUploadCard({ onUploaded, onFileSelected, deferUpload = false }: RosterUploadCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') {
      setMessage({ type: 'error', text: 'Selecione um arquivo PDF' });
      return;
    }
    setFile(selectedFile);
    onFileSelected?.(selectedFile);
    setMessage(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadRoster(formData);

      if (result.success) {
        setMessage({ type: 'success', text: result.message ?? 'Escala enviada com sucesso' });
        onUploaded?.(result.flights ?? []);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
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
    <div className="w-full max-w-md mx-auto p-4">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Upload Escala</h3>

        <div
          className="mb-4 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-blue-500 hover:bg-blue-50"
          onDrop={(event) => {
            event.preventDefault();
            const droppedFile = event.dataTransfer.files[0];
            if (droppedFile) handleFileSelect(droppedFile);
          }}
          onDragOver={(event) => event.preventDefault()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(event) => {
              const selectedFile = event.target.files?.[0];
              if (selectedFile) handleFileSelect(selectedFile);
            }}
          />

          {file ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  onFileSelected?.(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="rounded p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
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
              <p className="mt-1 text-sm text-gray-500">ou arraste e solte o PDF</p>
              <p className="mt-2 text-xs text-gray-500">PDF de até 50MB</p>
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
            isDisabled={!file || loading}
            className="w-full"
            size="lg"
          >
            {loading ? 'Enviando...' : 'Enviar Escala'}
          </Button>
        )}
      </div>
    </div>
  );
}
