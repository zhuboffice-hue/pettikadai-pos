import { useEffect, useRef } from 'react';

interface HardwareScannerOptions {
    onScan: (barcode: string) => void;
    minChars?: number;
    maxInterKeyInterval?: number; // milliseconds between keystrokes to be considered "machine speed"
}

export function useHardwareScanner({
    onScan,
    minChars = 3,
    maxInterKeyInterval = 50
}: HardwareScannerOptions) {
    const buffer = useRef<string>("");
    const lastKeyTime = useRef<number>(0);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const now = Date.now();
            const timeDiff = now - lastKeyTime.current;

            // If the user is typing slowly, assume it's manual input and reset buffer
            if (timeDiff > maxInterKeyInterval && buffer.current.length > 0) {
                // But wait, the FIRST character of a scan will have a long interval.
                // We should only reset if the PREVIOUS sequence was interrupted.
                // Actually simpler: 
                // If interval is long, this CURRENT key is the start of a new potential sequence.
                // So we reset buffer to just this key.
                buffer.current = "";
            }

            if (e.key === 'Enter') {
                // Check if buffer is valid scan
                if (buffer.current.length >= minChars && timeDiff <= maxInterKeyInterval) {
                    // Prevent default behavior (like form submission)
                    e.preventDefault();
                    console.log("Hardware Scan Detected:", buffer.current);
                    onScan(buffer.current);
                    buffer.current = "";
                } else {
                    // Manual enter or too short - clear buffer
                    buffer.current = "";
                }
            } else if (e.key.length === 1) {
                // Printable character
                buffer.current += e.key;
            }

            lastKeyTime.current = now;
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onScan, minChars, maxInterKeyInterval]);
}
