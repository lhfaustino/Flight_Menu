import { Radar } from "lucide-react";

export default function RadarPernoiteLoading() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8">
          <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Radar className="size-6" />
          </div>
          <div className="h-9 w-72 rounded-md bg-gray-200" />
          <div className="mt-3 h-5 w-full max-w-2xl rounded-md bg-gray-200" />
        </div>

        <section className="grid gap-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-gray-200" />
                <div className="grid flex-1 gap-2">
                  <div className="h-4 w-44 rounded-md bg-gray-200" />
                  <div className="h-3 w-28 rounded-md bg-gray-100" />
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
