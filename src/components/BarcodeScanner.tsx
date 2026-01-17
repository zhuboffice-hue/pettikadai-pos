import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import Tesseract from "tesseract.js";
import { Loader2, ScanLine, Image as ImageIcon } from "lucide-react";
import { toast } from "react-hot-toast";

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onScanFailure?: (error: any) => void;
}

export default function BarcodeScanner({ onScanSuccess, onScanFailure }: BarcodeScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isStarted, setIsStarted] = useState(false);
    const [status, setStatus] = useState("Initializing camera...");
    const [permissionError, setPermissionError] = useState<string | null>(null);

    const readerRef = useRef<BrowserMultiFormatReader | null>(null);
    const ocrTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isDecodedRef = useRef(false);

    useEffect(() => {
        let isMounted = true;
        isDecodedRef.current = false;

        const initScanner = async () => {
            if (!videoRef.current) return;

            // Initialize ZXing Reader
            readerRef.current = new BrowserMultiFormatReader();

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    // Wait for video to play before decoding
                    await videoRef.current.play();
                }

                setIsStarted(true);
                setStatus("Scanning barcode...");

                // Start Decoding
                readerRef.current.decodeFromVideoElement(
                    videoRef.current!,
                    (result, error) => {
                        if (result && !isDecodedRef.current) {
                            handleSuccess(result.text, "Barcode");
                        }
                    }
                );

                // Setup OCR Fallback
                ocrTimerRef.current = setTimeout(() => {
                    if (isMounted && !isDecodedRef.current && videoRef.current) {
                        captureAndOCR(videoRef.current);
                    }
                }, 2500);

            } catch (err: any) {
                console.error("Camera Error:", err);
                if (isMounted) setPermissionError("Camera access denied or unavailable.");
            }
        };

        initScanner();

        return () => {
            isMounted = false;
            // Stop ZXing
            // Note: decodeFromVideoElement returns a promise or control, but wrapper handles it usually.
            // To stop, we can stop the video tracks.
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(t => t.stop());
            }
            if (ocrTimerRef.current) clearTimeout(ocrTimerRef.current);
        };
    }, []);

    const handleSuccess = (text: string, source: string) => {
        if (isDecodedRef.current) return;
        isDecodedRef.current = true;
        setStatus(`${source} detected ✅`);
        toast.success(`${source} detected: ${text}`);
        onScanSuccess(text);
        if (ocrTimerRef.current) clearTimeout(ocrTimerRef.current);
    };

    const captureAndOCR = async (sourceItems: CanvasImageSource) => {
        if (!canvasRef.current) return;
        setStatus("Trying OCR...");

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        // Draw current frame
        const w = (sourceItems as any).videoWidth || (sourceItems as any).width;
        const h = (sourceItems as any).videoHeight || (sourceItems as any).height;

        if (!w || !h) return;

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(sourceItems, 0, 0);

        // Crop bottom 30%
        const cropY = h * 0.7;
        const cropH = h * 0.3;

        const imageData = ctx.getImageData(0, cropY, w, cropH);

        // Upscale for Tesseract
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = w * 2;
        tempCanvas.height = cropH * 2;
        const tctx = tempCanvas.getContext("2d");
        if (!tctx) return;

        tctx.filter = "grayscale(100%) contrast(300%)";
        // Put image data then draw it scaled? 
        // Better: Draw the cropped region from original canvas scaled up
        tctx.drawImage(canvas, 0, cropY, w, cropH, 0, 0, w * 2, cropH * 2);

        try {
            const { data: { text } } = await Tesseract.recognize(
                tempCanvas,
                "eng",
                {
                    // Tesseract options if possible to restrict charset, but usually handled in worker params
                    // In v5, options are 3rd arg? 
                    // User snippet: { tessedit_char_whitelist: "0123456789" }
                }
            );

            // Filter digits
            const digits = text.replace(/\D/g, "");
            // Typical barcodes are 8, 12, 13, 14 digits
            if (digits.length >= 8 && digits.length <= 14) {
                handleSuccess(digits, "OCR");
            } else {
                if (!isDecodedRef.current) setStatus("OCR failed — try better lighting");
            }

        } catch (e) {
            console.error("OCR Error:", e);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !readerRef.current) return;

        isDecodedRef.current = false;
        setStatus("Processing Image...");

        const imgUrl = URL.createObjectURL(file);
        const img = new Image();
        img.src = imgUrl;

        img.onload = async () => {
            try {
                // Try Barcode
                const result = await readerRef.current!.decodeFromImageUrl(imgUrl);
                handleSuccess(result.text, "Barcode");
            } catch (err) {
                // Try OCR
                await captureAndOCR(img);
            } finally {
                URL.revokeObjectURL(imgUrl);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
    };

    return (
        <div className="relative w-full h-full bg-black rounded-xl overflow-hidden group">
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
            />
            {/* Hidden Canvas for OCR */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Hidden Input */}
            <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
            />

            {/* Overlay */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                {/* Scan Frame */}
                <div className="relative w-64 h-64 border-2 border-primary/50 rounded-lg">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-primary animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                    {/* Corner Markers */}
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary"></div>
                </div>
                <p className="mt-4 text-white text-xs bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                    {status}
                </p>
            </div>

            {/* Upload Button */}
            <div className="absolute bottom-4 right-4 z-10 pointer-events-auto">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-circle btn-neutral bg-black/50 border-white/20 hover:bg-black/70 tooltip tooltip-left"
                    data-tip="Upload Image"
                >
                    <ImageIcon className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* Error State */}
            {permissionError && (
                <div className="absolute inset-0 flex items-center justify-center bg-base-200 p-4 text-center z-20">
                    <p className="text-error font-medium text-sm">{permissionError}</p>
                </div>
            )}

            <style jsx global>{`
                @keyframes scan {
                    0% { top: 0; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
            `}</style>
        </div>
    );
}
