import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onScanFailure?: (error: any) => void;
}

export default function BarcodeScanner({ onScanSuccess, onScanFailure }: BarcodeScannerProps) {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);
    const scannerId = "html5-qrcode-reader";

    useEffect(() => {
        // Ensure we don't create multiple instances
        if (scannerRef.current) {
            return;
        }

        const scanner = new Html5QrcodeScanner(
            scannerId,
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
        );

        scannerRef.current = scanner;

        scanner.render(
            (decodedText) => {
                onScanSuccess(decodedText);
            },
            (error) => {
                if (onScanFailure) onScanFailure(error);
            }
        );

        // Cleanup function
        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => {
                    console.error("Failed to clear scanner", error);
                });
                scannerRef.current = null;
            }
        };
    }, [onScanSuccess, onScanFailure]);

    return <div id={scannerId} className="w-full"></div>;
}
