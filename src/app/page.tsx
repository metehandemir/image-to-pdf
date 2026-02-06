"use client";

import { jsPDF } from "jspdf";
import { useCallback, useRef, useState } from "react";

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getImageSize(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function Home() {
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (validFiles.length === 0) return;

    setImages((prev) => [...prev, ...validFiles]);

    validFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      setPreviews((prev) => [...prev, url]);
    });
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setImages([]);
    setPreviews([]);
  };

  const swapItems = (from: number, to: number) => {
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setPreviews((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const moveUp = (index: number) => {
    if (index > 0) swapItems(index, index - 1);
  };

  const moveDown = (index: number) => {
    if (index < images.length - 1) swapItems(index, index + 1);
  };

  const handleItemDragStart = (index: number) => {
    setDraggedIdx(index);
  };

  const handleItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    setDragOverIdx(index);
  };

  const handleItemDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx !== null && draggedIdx !== index) {
      swapItems(draggedIdx, index);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleItemDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDownload = async () => {
    if (images.length === 0) {
      alert("Please select at least one image file.");
      return;
    }

    setIsConverting(true);

    try {
      let pdf: jsPDF | null = null;

      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const imageDataUrl = await readFileAsDataURL(file);

        const imageSize = await getImageSize(imageDataUrl);

        // Convert image dimensions from pixels to millimeters (1 inch = 25.4 mm, 1 inch = 96 pixels)
        const widthInMm = (imageSize.width / 96) * 25.4;
        const heightInMm = (imageSize.height / 96) * 25.4;

        if (i === 0) {
          pdf = new jsPDF({
            orientation: widthInMm > heightInMm ? "l" : "p",
            unit: "mm",
            format: [widthInMm, heightInMm],
          });
        } else {
          pdf!.addPage(
            [widthInMm, heightInMm],
            widthInMm > heightInMm ? "l" : "p"
          );
        }

        pdf!.addImage(imageDataUrl, "JPEG", 0, 0, widthInMm, heightInMm);
      }

      pdf!.save("converted.pdf");
    } catch {
      alert("An error occurred while converting images to PDF.");
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16 sm:py-24">
      {/* Header */}
      <div className="text-center mb-12 max-w-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs text-muted mb-6">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Open Source &middot; Free &middot; No upload &middot; Runs locally
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Images to PDF
        </h1>
        <p className="text-muted text-base sm:text-lg leading-relaxed">
          Convert your images into a single PDF file. Everything happens in your
          browser — nothing is uploaded.
        </p>
      </div>

      {/* Drop Zone */}
      <div className="w-full max-w-2xl">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative group cursor-pointer rounded-xl border-2 border-dashed
            transition-all duration-200 ease-in-out
            flex flex-col items-center justify-center gap-3 p-10 sm:p-14
            ${
              isDragging
                ? "border-accent bg-accent/5 scale-[1.01]"
                : "border-border hover:border-muted hover:bg-card"
            }
          `}
        >
          <svg
            className={`w-10 h-10 transition-colors ${
              isDragging ? "text-accent" : "text-muted"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
            />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium">
              Drop images here or{" "}
              <span className="underline underline-offset-4 decoration-muted">
                browse
              </span>
            </p>
            <p className="text-xs text-muted mt-1">
              PNG, JPG, JPEG, WEBP supported
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleImageChange}
          multiple
          className="hidden"
        />

        {/* Image List */}
        {images.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">
                {images.length} {images.length === 1 ? "image" : "images"}{" "}
                selected
              </p>
              <button
                onClick={clearAll}
                className="text-xs text-muted hover:text-destructive transition-colors cursor-pointer"
              >
                Clear all
              </button>
            </div>

            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
              {images.map((file, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={() => handleItemDragStart(index)}
                  onDragOver={(e) => handleItemDragOver(e, index)}
                  onDrop={(e) => handleItemDrop(e, index)}
                  onDragEnd={handleItemDragEnd}
                  className={`
                    flex items-center gap-3 p-3 bg-card transition-all
                    ${draggedIdx === index ? "opacity-40" : ""}
                    ${
                      dragOverIdx === index && draggedIdx !== index
                        ? "border-t-2 border-t-accent"
                        : ""
                    }
                    ${draggedIdx !== null ? "cursor-grabbing" : "cursor-grab"}
                  `}
                >
                  {/* Drag Handle */}
                  <div className="flex-shrink-0 text-muted/50 hover:text-muted transition-colors">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 9h16.5m-16.5 6.75h16.5"
                      />
                    </svg>
                  </div>

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previews[index]}
                    alt={file.name}
                    className="w-12 h-12 object-cover rounded-lg border border-border flex-shrink-0"
                    draggable={false}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted">
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  <span className="text-xs text-muted font-mono flex-shrink-0">
                    {index + 1}/{images.length}
                  </span>

                  {/* Reorder Arrows */}
                  {images.length > 1 && (
                    <div className="flex flex-col flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveUp(index);
                        }}
                        disabled={index === 0}
                        className={`p-0.5 rounded transition-colors cursor-pointer ${
                          index === 0
                            ? "text-muted/25 cursor-not-allowed"
                            : "text-muted hover:text-foreground hover:bg-border"
                        }`}
                        aria-label="Move up"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m4.5 15.75 7.5-7.5 7.5 7.5"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveDown(index);
                        }}
                        disabled={index === images.length - 1}
                        className={`p-0.5 rounded transition-colors cursor-pointer ${
                          index === images.length - 1
                            ? "text-muted/25 cursor-not-allowed"
                            : "text-muted hover:text-foreground hover:bg-border"
                        }`}
                        aria-label="Move down"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m19.5 8.25-7.5 7.5-7.5-7.5"
                          />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Remove */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                    className="p-1.5 rounded-md hover:bg-border transition-colors text-muted hover:text-foreground cursor-pointer flex-shrink-0"
                    aria-label={`Remove ${file.name}`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18 18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Convert Button */}
            <button
              onClick={handleDownload}
              disabled={isConverting}
              className={`
                w-full py-3 px-6 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer
                ${
                  isConverting
                    ? "bg-accent/60 text-accent-foreground/60 cursor-not-allowed"
                    : "bg-accent text-accent-foreground hover:opacity-90 active:scale-[0.99]"
                }
              `}
            >
              {isConverting ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Converting...
                </span>
              ) : (
                "Download PDF"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-16 text-center flex flex-col items-center gap-3">
        <a
          href="https://github.com/metehandemir/image-to-pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
          Source on GitHub
        </a>
        <p className="text-xs text-muted">
          Built with Next.js &middot; Your files never leave your device
        </p>
      </div>
    </div>
  );
}

export default Home;
