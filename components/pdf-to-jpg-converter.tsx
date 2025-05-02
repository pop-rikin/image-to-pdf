"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  UploadIcon,
  DownloadIcon,
  FileIcon,
  FileArchiveIcon as ZipIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AlertCircleIcon,
} from "lucide-react"
import JSZip from "jszip"
import FileSaver from "file-saver"

// We'll dynamically import the PDF.js library
declare global {
  interface Window {
    pdfjsLib: any
  }
}

interface PagePreview {
  dataUrl: string
  pageNumber: number
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB limit
const MAX_HEIGHT = 480 // Max height constraint

export function PdfToJpgConverter() {
  const [file, setFile] = useState<File | null>(null)
  const [previews, setPreviews] = useState<PagePreview[]>([])
  const [baseFilename, setBaseFilename] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [hasUploaded, setHasUploaded] = useState(false) // Track if a file has been uploaded
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)

  // Load PDF.js library
  useEffect(() => {
    const loadPdfJs = async () => {
      if (typeof window !== "undefined" && !window.pdfjsLib) {
        const pdfjsScript = document.createElement("script")
        pdfjsScript.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
        pdfjsScript.onload = () => {
          // Initialize PDF.js worker
          const pdfjsWorker = document.createElement("script")
          pdfjsWorker.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
          pdfjsWorker.onload = () => {
            setPdfJsLoaded(true)
          }
          document.body.appendChild(pdfjsWorker)
        }
        document.body.appendChild(pdfjsScript)
      } else if (typeof window !== "undefined" && window.pdfjsLib) {
        setPdfJsLoaded(true)
      }
    }

    loadPdfJs()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null

    if (selectedFile) {
      // Check file size
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`)
        return
      }

      // Check file type
      if (selectedFile.type !== "application/pdf") {
        setError("Only PDF files are supported.")
        return
      }

      // Set hasUploaded to true when a valid file is selected
      setHasUploaded(true)
    } else {
      // If file selection is canceled, don't change hasUploaded state
    }

    setFile(selectedFile)
    setPreviews([])
    setError(null)
    setTotalPages(0)
    setCurrentPage(0)
  }

  const renderPageToCanvas = async (pdf: any, pageNumber: number): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Get the page
        const page = await pdf.getPage(pageNumber)

        // Determine the scale to render at (adjust as needed)
        const viewport = page.getViewport({ scale: 1.5 })

        // Prepare canvas for rendering
        const canvas = canvasRef.current
        if (!canvas) throw new Error("Canvas not available")

        canvas.width = viewport.width
        canvas.height = viewport.height

        // Render PDF page to canvas
        const renderContext = {
          canvasContext: canvas.getContext("2d"),
          viewport: viewport,
        }

        await page.render(renderContext).promise

        // Convert canvas to JPG
        const jpgDataUrl = canvas.toDataURL("image/jpeg")
        resolve(jpgDataUrl)
      } catch (error) {
        reject(error)
      }
    })
  }

  const convertPdfToJpg = async (pdfFile: File): Promise<void> => {
    const fileReader = new FileReader()

    fileReader.onload = async function () {
      try {
        const typedArray = new Uint8Array(this.result as ArrayBuffer)

        // Load the PDF file
        const loadingTask = window.pdfjsLib.getDocument({ data: typedArray })
        const pdf = await loadingTask.promise

        // Get total number of pages
        const pageCount = pdf.numPages
        setTotalPages(pageCount)

        // Process each page
        const newPreviews: PagePreview[] = []

        // Process pages in batches to prevent memory issues
        const batchSize = 5 // Process 5 pages at a time

        for (let i = 1; i <= pageCount; i += batchSize) {
          const endPage = Math.min(i + batchSize - 1, pageCount)

          // Process this batch
          for (let j = i; j <= endPage; j++) {
            setCurrentPage(j)
            try {
              const jpgDataUrl = await renderPageToCanvas(pdf, j)
              newPreviews.push({
                dataUrl: jpgDataUrl,
                pageNumber: j,
              })
            } catch (err) {
              console.error(`Error rendering page ${j}:`, err)
            }
          }

          // Update previews after each batch
          setPreviews([...newPreviews])

          // Small delay to allow UI updates
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error("Error converting PDF:", error)
        setError("Failed to convert PDF to JPG. Please try again with a smaller file.")
      }
    }

    fileReader.onerror = () => {
      setError("Failed to read the PDF file. Please try again.")
    }

    fileReader.readAsArrayBuffer(pdfFile)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      setError("Please select a PDF file")
      return
    }

    if (!pdfJsLoaded) {
      setError("PDF.js library is still loading. Please wait a moment and try again.")
      return
    }

    setLoading(true)
    setError(null)
    setPreviews([])

    try {
      // Client-side validation only
      if (file.type !== "application/pdf") {
        throw new Error("Only PDF files are supported.")
      }

      setBaseFilename(file.name.replace(".pdf", ""))

      // Convert the PDF to JPG on the client
      await convertPdfToJpg(file)
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to convert PDF to JPG. Please try again.")
    } finally {
      setLoading(false)
      setCurrentPage(0)
    }
  }

  const handleDownloadSingle = (dataUrl: string, pageNumber: number) => {
    if (!baseFilename) return

    const link = document.createElement("a")
    link.href = dataUrl
    link.download = `${baseFilename}-page-${pageNumber}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownloadAll = async () => {
    if (!baseFilename || previews.length === 0) return

    try {
      setLoading(true)

      const zip = new JSZip()

      // Add each JPG to the zip file
      previews.forEach((preview) => {
        // Convert data URL to blob
        const dataUrlParts = preview.dataUrl.split(",")
        const mimeType = dataUrlParts[0].match(/:(.*?);/)?.[1] || "image/jpeg"
        const byteString = atob(dataUrlParts[1])
        const arrayBuffer = new ArrayBuffer(byteString.length)
        const uint8Array = new Uint8Array(arrayBuffer)

        for (let i = 0; i < byteString.length; i++) {
          uint8Array[i] = byteString.charCodeAt(i)
        }

        const blob = new Blob([arrayBuffer], { type: mimeType })

        // Add to zip
        zip.file(`${baseFilename}-page-${preview.pageNumber}.jpg`, blob)
      })

      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: "blob" })

      // Download the zip file using FileSaver
      FileSaver.saveAs(zipBlob, `${baseFilename}-all-pages.zip`)
    } catch (err) {
      console.error("Error creating zip file:", err)
      setError("Failed to create zip file. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const scrollGallery = (direction: "left" | "right") => {
    if (!galleryRef.current) return

    const scrollAmount = 300 // Adjust as needed
    const currentScroll = galleryRef.current.scrollLeft

    galleryRef.current.scrollTo({
      left: direction === "left" ? currentScroll - scrollAmount : currentScroll + scrollAmount,
      behavior: "smooth",
    })
  }

  // Calculate available height for the gallery based on other elements
  const calculateGalleryHeight = () => {
    // Estimate heights of other elements in a more compact layout:
    // - Upload area: ~70px (normal) or ~40px (compact)
    // - Button: ~32px
    // - Error message (if any): ~32px
    // - Gallery header: ~30px
    // - Page indicator dots: ~16px
    // - Padding and margins: ~30px
    const uploadAreaHeight = hasUploaded ? 40 : 70
    const otherElementsHeight =
      previews.length > 0
        ? 180 + uploadAreaHeight - 40
        : // If we have previews, add the difference in upload area height
          130 + uploadAreaHeight - 40 // If no previews, add the difference in upload area height

    return Math.max(160, MAX_HEIGHT - otherElementsHeight) // Minimum 160px height
  }

  const galleryHeight = calculateGalleryHeight()

  // Dynamic upload box height based on whether a file has been uploaded
  const uploadBoxHeight = hasUploaded ? "h-10" : "h-24"
  const uploadBoxPadding = hasUploaded ? "py-0.5" : "py-2"
  const uploadIconSize = hasUploaded ? "w-3.5 h-3.5" : "w-6 h-6"
  const uploadTextSize = hasUploaded ? "text-xs" : "text-sm"
  const uploadMarginBottom = hasUploaded ? "mb-0" : "mb-1"

  return (
    <div className="w-full" style={{ maxHeight: `${MAX_HEIGHT}px`, overflow: "hidden" }}>
      <div className="p-4">
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="space-y-1.5">
            <label
              htmlFor="pdf-upload"
              className={`flex flex-col items-center justify-center w-full ${uploadBoxHeight} border border-dashed rounded-lg cursor-pointer hover:bg-gray-50 border-gray-300 transition-all duration-200`}
            >
              <div className={`flex flex-col items-center justify-center ${uploadBoxPadding}`}>
                <UploadIcon className={`${uploadIconSize} ${uploadMarginBottom} text-gray-500`} />
                <p className={`${uploadTextSize} text-gray-500`}>
                  <span className="font-semibold">{hasUploaded ? "Change file" : "Click to upload"}</span>
                  {!hasUploaded && " or drag and drop"}
                </p>
                {!hasUploaded && (
                  <p className="text-xs text-gray-500">PDF files only (max {MAX_FILE_SIZE / (1024 * 1024)}MB)</p>
                )}
              </div>
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {file && (
              <div className="flex items-center gap-1.5 text-xs">
                <FileIcon className="w-3 h-3" />
                <span className="truncate">{file.name}</span>
                <span className="text-xs text-gray-500">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full h-8 text-sm py-0" disabled={!file || loading || !pdfJsLoaded}>
            {loading
              ? currentPage > 0
                ? `Converting ${currentPage}/${totalPages}...`
                : "Converting..."
              : "Convert to JPG"}
          </Button>

          {error && (
            <div className="p-1.5 text-xs text-red-500 bg-red-50 rounded-md flex items-start gap-1.5">
              <AlertCircleIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Hidden canvas for PDF rendering */}
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {previews.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Pages ({previews.length})</h3>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 h-6 px-2 text-xs"
                  onClick={handleDownloadAll}
                  disabled={loading}
                >
                  <ZipIcon className="w-3 h-3" />
                  Download All
                </Button>
              </div>

              {/* Swipeable gallery container with navigation buttons */}
              <div className="relative">
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10"
                  style={{ display: previews.length > 1 ? "block" : "none" }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="rounded-full bg-white/80 backdrop-blur-sm shadow-md h-6 w-6 p-0"
                    onClick={() => scrollGallery("left")}
                  >
                    <ChevronLeftIcon className="h-3 w-3" />
                  </Button>
                </div>

                <div
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10"
                  style={{ display: previews.length > 1 ? "block" : "none" }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="rounded-full bg-white/80 backdrop-blur-sm shadow-md h-6 w-6 p-0"
                    onClick={() => scrollGallery("right")}
                  >
                    <ChevronRightIcon className="h-3 w-3" />
                  </Button>
                </div>

                {/* Scrollable gallery */}
                <div
                  ref={galleryRef}
                  className="flex overflow-x-auto pb-1.5 gap-3 snap-x snap-mandatory hide-scrollbar"
                  style={{
                    maxHeight: `${galleryHeight}px`,
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  {previews.map((preview) => (
                    <div
                      key={preview.pageNumber}
                      className="border rounded-lg overflow-hidden flex-shrink-0 snap-center"
                      style={{
                        width: "calc(100% - 1.5rem)",
                        maxHeight: `${galleryHeight}px`,
                        scrollSnapAlign: "center",
                      }}
                    >
                      <div className="p-1 bg-gray-50 border-b flex justify-between items-center sticky top-0 z-10">
                        <span className="font-medium text-xs">Page {preview.pageNumber}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-0.5 h-5 px-1.5 py-0"
                          onClick={() => handleDownloadSingle(preview.dataUrl, preview.pageNumber)}
                        >
                          <DownloadIcon className="w-2.5 h-2.5" />
                          <span className="text-xs">Download</span>
                        </Button>
                      </div>
                      <div className="overflow-auto" style={{ maxHeight: `${galleryHeight - 28}px` }}>
                        <img
                          src={preview.dataUrl || "/placeholder.svg"}
                          alt={`Page ${preview.pageNumber}`}
                          className="w-full h-auto"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Page indicator dots */}
              {previews.length > 1 && (
                <div className="flex justify-center gap-1">
                  {previews.map((_, index) => (
                    <div key={index} className="w-1 h-1 rounded-full bg-gray-300" aria-hidden="true" />
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
} 