import { EmbeddableConverter } from "@/components/embeddable-converter"

export default function EmbedPage() {
  const embedCode = `<iframe 
  src="${process.env.NEXT_PUBLIC_VERCEL_URL || "http://localhost:3000"}/embed/widget" 
  width="100%" 
  height="480px" 
  frameborder="0"
  style="max-width: 500px; margin: 0 auto; display: block; background: transparent;"
  allowtransparency="true"
></iframe>`

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Embed PDF to JPG Converter</h1>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Preview</h2>
        <div className="border p-4 rounded-lg">
          <h1 className="text-2xl font-bold text-center mb-6">PDF to JPG Converter</h1>
          <EmbeddableConverter />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Embed Code</h2>
        <div className="bg-gray-100 p-4 rounded-lg">
          <pre className="text-sm overflow-x-auto whitespace-pre-wrap">{embedCode}</pre>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Copy and paste this code into your website to embed the PDF to JPG converter.
        </p>
      </div>
    </div>
  )
}
