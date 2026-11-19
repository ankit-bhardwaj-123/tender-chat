"use client";

import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface LetterheadPageProps {
  url: string;
  width: number;
  onError: () => void;
}

export default function LetterheadPage({ url, width, onError }: LetterheadPageProps) {
  return (
    <Document file={url} loading={null} error={null} onLoadError={onError}>
      <Page
        pageNumber={1}
        width={width}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        loading={null}
        onRenderError={onError}
      />
    </Document>
  );
}
