"use client"

import { PdfToJpgConverter } from "./pdf-to-jpg-converter"

export function EmbeddableConverter() {
  return (
    <div
      className="pdf-to-jpg-converter-widget"
      style={{
        width: "100%",
        margin: "0",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <PdfToJpgConverter />
    </div>
  )
}
