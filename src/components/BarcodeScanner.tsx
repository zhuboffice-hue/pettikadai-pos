import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Loader2, ScanLine, Image as ImageIcon } from "lucide-react";
import { toast } from "react-hot-toast";

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onScanFailure?: (error: any) => void;
}

export default function BarcodeScanner({ onScanSuccess, onScanFailure }: BarcodeScannerProps) {
    const scannerId = "html5-qrcode-reader";
    const [isStarted, setIsStarted] = useState(false);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let isMounted = true;
        // Track scan state internally to handle strict mode cleanup reliably
        const activeScanRef = { current: false };

        const initScanner = async () => {
            // Initialize if not already done
            if (!html5QrCodeRef.current) {
                html5QrCodeRef.current = new Html5Qrcode(scannerId);
            }

            const qrCode = html5QrCodeRef.current;

            try {
                await qrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 15,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0,
                    },
                    (decodedText) => {
                        if (isMounted) onScanSuccess(decodedText);
                    },
                    (errorMessage) => {
                        // Ignore frame errors
                    }
                );

                activeScanRef.current = true;
                if (isMounted) setIsStarted(true);
            } catch (err: any) {
                if (isMounted) {
                    console.error("Error starting scanner:", err);
                    setPermissionError("Camera error. Please check permissions and try again.");
                    if (onScanFailure) onScanFailure(err);
                }
            }
        };

        // Small timeout to allow UI to settle before starting camera
        const timer = setTimeout(() => {
            initScanner();
        }, 100);

        return () => {
            isMounted = false;
            clearTimeout(timer);

            if (html5QrCodeRef.current) {
                if (activeScanRef.current) {
                    html5QrCodeRef.current.stop()
                        .then(() => html5QrCodeRef.current?.clear())
                        .catch(err => {
                            console.warn("Scanner stop warning:", err);
                        });
                } else {
                    try { html5QrCodeRef.current.clear(); } catch (e) { }
                }
            }
        };
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !html5QrCodeRef.current) return;

        try {
            const decodedText = await html5QrCodeRef.current.scanFileV2(file, true);
            if (decodedText) {
                onScanSuccess(decodedText as unknown as string);
                toast.success("Image scanned successfully!");
            }
        } catch (err) {
            console.error("File scan failed", err);
            toast.error("Could not read barcode from image. Try a clearer image.");
        } finally {
            // Reset input so same file can be selected again
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="relative w-full h-full bg-black rounded-xl overflow-hidden group">
            <div id={scannerId} className="w-full h-full"></div>

            {/* Hidden Input */}
            <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
            />

            {/* Custom Overlay */}
            {isStarted && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    {/* Scan Frame */}
                    <div className="relative w-64 h-64 border-2 border-primary/50 rounded-lg">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-primary animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary"></div>
                    </div>
                    <p className="mt-4 text-white text-xs bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                        Align barcode within frame
                    </p>
                </div>
            )}

            {/* Upload Button */}
            <div className="absolute bottom-4 right-4 z-10">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-circle btn-neutral bg-black/50 border-white/20 hover:bg-black/70 tooltip tooltip-left"
                    data-tip="Upload Image"
                >
                    <ImageIcon className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* Loading State */}
            {!isStarted && !permissionError && (
                <div className="absolute inset-0 flex items-center justify-center bg-base-200">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            )}

            {/* Error State */}
            {permissionError && (
                <div className="absolute inset-0 flex items-center justify-center bg-base-200 p-4 text-center">
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
