import { ImageToPdfConverter } from "@/components/image-to-pdf-converter"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 pt-8">
      <div className="w-full max-w-md">
        <ImageToPdfConverter />
      </div>
    </main>
  )
}
