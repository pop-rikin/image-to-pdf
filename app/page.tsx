import { PdfToJpgConverter } from "@/components/pdf-to-jpg-converter"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <PdfToJpgConverter />
      </div>
    </main>
  )
}
