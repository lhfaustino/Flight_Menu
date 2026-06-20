"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function RadarPernoiteError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl px-4">
        <section className="rounded-lg border border-error-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-error-50 text-error-700">
            <AlertCircle className="size-6" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Nao foi possivel carregar o Radar do Pernoite</h1>
          <p className="mt-2 text-sm text-gray-500">{error.message || "Tente novamente em alguns instantes."}</p>
          <Button type="button" iconLeading={RotateCcw} onPress={reset} className="mt-5">
            Tentar novamente
          </Button>
        </section>
      </div>
    </div>
  );
}
