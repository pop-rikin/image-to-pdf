"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  UploadIcon,
  DownloadIcon,
  FileIcon,
  ImageIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  XIcon,
  MoveUpIcon,
  MoveDownIcon,
} from "lucide-react"
import { jsPDF } from "jspdf"

interface ImagePreview {
  dataUrl: string
  file: File
  id: string // unique identifier for reordering
}

type OrientationOption = "auto" | "portrait" | "landscape"
type PageSizeOption = "a4" | "letter" | "legal"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit per image
const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50MB total limit
const MAX_HEIGHT = 520 // Max app height constraint
const PREVIEW_HEIGHT = 80 // Reduced height for image previews
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

const PAGE_SIZES = {
  a4: [210, 297],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
}

export function ImageToPdfConverter() {
  const [images, setImages] = useState<ImagePreview[]>([])
  const [outputFilename, setOutputFilename] = useState<string>("converted-document")
  const [orientation, setOrientation] = useState<OrientationOption>("auto")
  const [pageSize, setPageSize] = useState<PageSizeOption>("a4")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasUploaded, setHasUploaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files

    if (!selectedFiles || selectedFiles.length === 0) {
      return
    }

    // Check for valid file types and sizes
    let totalSize = 0
    const filePromises: Promise<ImagePreview>[] = []

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      
      // Check file type
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setError(`File "${file.name}" is not a supported image type.`)
        continue
      }

      // Check individual file size
      if (file.size > MAX_FILE_SIZE) {
        setError(`File "${file.name}" exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB per image limit.`)
        continue
      }

      totalSize += file.size

      // Create a promise to read the file
      const filePromise = new Promise<ImagePreview>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          resolve({
            dataUrl: e.target?.result as string,
            file: file,
            id: crypto.randomUUID(),
          })
        }
        reader.readAsDataURL(file)
      })

      filePromises.push(filePromise)
    }

    // Check total size
    if (totalSize > MAX_TOTAL_SIZE) {
      setError(`Total file size exceeds the ${MAX_TOTAL_SIZE / (1024 * 1024)}MB limit.`)
      return
    }

    // Process all file promises
    Promise.all(filePromises).then((loadedImages) => {
      // Combine with existing images
      setImages((prevImages) => [...prevImages, ...loadedImages])
      setHasUploaded(true)
      setError(null)
      
      // Reset the file input to allow selecting the same files again
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    })
  }

  const removeImage = (id: string) => {
    setImages((prevImages) => {
      const filtered = prevImages.filter(img => img.id !== id)
      if (filtered.length === 0) {
        setHasUploaded(false)
      }
      return filtered
    })
  }

  const clearAllImages = () => {
    setImages([])
    setHasUploaded(false)
    setError(null)
  }

  const moveImage = (id: string, direction: 'up' | 'down') => {
    setImages((prevImages) => {
      const index = prevImages.findIndex(img => img.id === id)
      if (index === -1) return prevImages
      
      // If moving up and already at top, or moving down and already at bottom, do nothing
      if ((direction === 'up' && index === 0) || 
          (direction === 'down' && index === prevImages.length - 1)) {
        return prevImages
      }
      
      const newImages = [...prevImages]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      
      // Swap the images
      const temp = newImages[index]
      newImages[index] = newImages[targetIndex]
      newImages[targetIndex] = temp
      
      return newImages
    })
  }

  const scrollGallery = (direction: "left" | "right") => {
    if (!galleryRef.current) return

    const scrollAmount = 200
    galleryRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    })
  }

  const generatePdf = async () => {
    if (images.length === 0) {
      setError("Please select at least one image")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get the selected page size dimensions
      const [width, height] = PAGE_SIZES[pageSize]
      
      // Initialize PDF with selected page size and default portrait orientation
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [width, height],
      })

      // Add each image as a new page
      for (let i = 0; i < images.length; i++) {
        // Create an image element to get dimensions
        const img = new Image()
        img.src = images[i].dataUrl
        
        await new Promise<void>((resolve) => {
          img.onload = () => {
            // Determine orientation based on image dimensions or user selection
            let pageOrientation: 'portrait' | 'landscape'
            
            if (orientation === "auto") {
              pageOrientation = img.width > img.height ? 'landscape' : 'portrait'
            } else {
              pageOrientation = orientation
            }
            
            // Add new page if it's not the first image
            if (i > 0) {
              // Add page with the appropriate orientation
              pdf.addPage([width, height], pageOrientation)
            } else if (pageOrientation === 'landscape') {
              // For the first page, if it's landscape, we need to change the orientation
              pdf.deletePage(1)
              pdf.addPage([height, width], 'landscape')
            }
            
            // Get current page dimensions after orientation is set
            const pageWidth = pdf.internal.pageSize.getWidth()
            const pageHeight = pdf.internal.pageSize.getHeight()
            
            // Calculate scale to fit within page bounds
            const imgRatio = img.width / img.height
            const pageRatio = pageWidth / pageHeight
            
            let imgWidth = pageWidth
            let imgHeight = pageHeight
            
            if (imgRatio > pageRatio) {
              // Image is wider than page ratio
              imgHeight = pageWidth / imgRatio
            } else {
              // Image is taller than page ratio
              imgWidth = pageHeight * imgRatio
            }
            
            // Center image on page
            const xOffset = (pageWidth - imgWidth) / 2
            const yOffset = (pageHeight - imgHeight) / 2
            
            // Add image to PDF
            pdf.addImage(images[i].dataUrl, 'JPEG', xOffset, yOffset, imgWidth, imgHeight)
            resolve()
          }
        })
      }

      // Save the PDF
      pdf.save(`${outputFilename}.pdf`)
    } catch (err: any) {
      console.error("Error generating PDF:", err)
      setError(err.message || "Failed to generate PDF. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 max-h-[520px] overflow-auto">
      <div className="bg-white rounded-lg border p-3 shadow-sm">
        {/* File input */}
        <div className="space-y-3">
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="image-upload"
              className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
            >
              <div className="flex flex-col items-center justify-center pt-3 pb-3">
                <UploadIcon className="w-6 h-6 mb-1 text-gray-500" />
                <p className="mb-1 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">
                  JPG, PNG, GIF, WEBP (max 10MB per image)
                </p>
              </div>
              <input
                id="image-upload"
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg, image/png, image/gif, image/webp"
                multiple
                onChange={handleFileChange}
              />
            </label>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start p-3 space-x-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* PDF Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Filename input */}
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="filename" className="text-sm font-medium text-gray-700">
                Output Filename
              </label>
              <input
                id="filename"
                type="text"
                value={outputFilename}
                onChange={(e) => setOutputFilename(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter filename without extension"
              />
            </div>
            
            {/* Orientation selection */}
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="orientation" className="text-sm font-medium text-gray-700">
                Page Orientation
              </label>
              <select
                id="orientation"
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as OrientationOption)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="auto">Auto (Based on Image)</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            
            {/* Page size selection */}
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="pageSize" className="text-sm font-medium text-gray-700">
                Page Size
              </label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as PageSizeOption)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="legal">Legal</option>
              </select>
            </div>
          </div>
        </div>

        {/* Image previews */}
        {images.length > 0 && (
          <div className="mt-3 relative">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-sm font-medium text-gray-700">
                {images.length} {images.length === 1 ? "Image" : "Images"} Selected
              </h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAllImages}
                className="text-xs h-7 px-2"
              >
                Clear All
              </Button>
            </div>
            
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => scrollGallery("left")}
                disabled={images.length <= 3}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              
              <div
                ref={galleryRef}
                className="flex space-x-2 overflow-x-auto py-1 max-w-full scrollbar-hide"
                style={{ maxHeight: `${PREVIEW_HEIGHT + 20}px` }}
              >
                {images.map((image, index) => (
                  <div key={image.id} className="relative shrink-0 border rounded">
                    <img
                      src={image.dataUrl}
                      alt={`Preview ${index + 1}`}
                      className="object-cover rounded"
                      style={{ height: `${PREVIEW_HEIGHT}px`, width: 'auto' }}
                    />
                    <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5">
                      <button
                        onClick={() => removeImage(image.id)}
                        className="bg-white rounded-full p-0.5 shadow hover:bg-red-50"
                        title="Remove image"
                      >
                        <XIcon className="h-2.5 w-2.5 text-red-500" />
                      </button>
                      <button
                        onClick={() => moveImage(image.id, 'up')}
                        className="bg-white rounded-full p-0.5 shadow hover:bg-blue-50"
                        title="Move up"
                        disabled={index === 0}
                      >
                        <MoveUpIcon className="h-2.5 w-2.5 text-blue-500" />
                      </button>
                      <button
                        onClick={() => moveImage(image.id, 'down')}
                        className="bg-white rounded-full p-0.5 shadow hover:bg-blue-50"
                        title="Move down"
                        disabled={index === images.length - 1}
                      >
                        <MoveDownIcon className="h-2.5 w-2.5 text-blue-500" />
                      </button>
                    </div>
                    <div className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-xs py-0 px-1 rounded text-[10px]">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => scrollGallery("right")}
                disabled={images.length <= 3}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Convert button */}
        <div className="mt-3">
          <Button
            onClick={generatePdf}
            disabled={loading || images.length === 0}
            className="w-full"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              <span className="flex items-center">
                <DownloadIcon className="mr-2 h-4 w-4" />
                Convert to PDF
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
} 