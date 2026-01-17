// ThermalPrinter - Bluetooth thermal printer utility for 55mm paper
// Uses Web Bluetooth API for direct ESC/POS printing

export interface PrinterDevice {
    device: BluetoothDevice | null;
    name: string;
    isConnected: boolean;
}

export class ThermalPrinter {
    private device: BluetoothDevice | null = null;
    private server: BluetoothRemoteGATTServer | null = null;
    private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
    public isConnected: boolean = false;
    private isReconnecting: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 3;
    private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
    private connectionWatchdog: ReturnType<typeof setInterval> | null = null;

    // Paper width for 55mm thermal printer (384 dots at 203 DPI)
    private readonly PAPER_WIDTH = 384;
    private readonly BYTES_PER_LINE = 48; // 384 / 8

    // ESC/POS Commands
    private readonly ESC = 0x1B;
    private readonly GS = 0x1D;
    private readonly LF = 0x0A;

    /**
     * Start keep-alive ping to prevent printer disconnect
     */
    private startKeepAlive(): void {
        this.stopKeepAlive();

        // Send a status request every 10 seconds to keep connection alive
        this.keepAliveInterval = setInterval(async () => {
            if (this.isConnected && this.characteristic) {
                try {
                    // Send ESC ENQ (enquiry) - a harmless status check
                    await this.characteristic.writeValue(new Uint8Array([0x10, 0x04, 0x01]));
                } catch (error) {
                    console.log('Keep-alive ping failed, connection may be lost');
                    this.isConnected = false;
                }
            }
        }, 10000);

        // Watchdog to check connection status
        this.connectionWatchdog = setInterval(() => {
            if (this.device && this.server && !this.server.connected) {
                console.log('Watchdog detected disconnection');
                this.isConnected = false;
                this.server = null;
                this.characteristic = null;
            }
        }, 5000);
    }

    /**
     * Stop keep-alive mechanism
     */
    private stopKeepAlive(): void {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        if (this.connectionWatchdog) {
            clearInterval(this.connectionWatchdog);
            this.connectionWatchdog = null;
        }
    }

    /**
     * Static helper to scan, connect, and return a ready printer instance
     */
    static async connectAndGetPrinter(): Promise<ThermalPrinter> {
        const printer = new ThermalPrinter();
        await printer.scanForPrinters();
        await printer.connect();
        return printer;
    }

    /**
     * Get the current device info
     */
    getDeviceInfo(): PrinterDevice {
        return {
            device: this.device,
            name: this.device?.name || 'Unknown Printer',
            isConnected: this.isConnected
        };
    }

    /**
     * Scan for Bluetooth printers and allow user to select one
     */
    async scanForPrinters(): Promise<BluetoothDevice> {
        if (!navigator.bluetooth) {
            throw new Error('Web Bluetooth API is not available in this browser.');
        }

        try {
            // Request device with common thermal printer services
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: [0x18F0] }, // Standard serial port over BLE
                ],
                optionalServices: [
                    0x18F0,
                    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
                    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                ]
            });

            if (!this.device) {
                throw new Error('No printer selected.');
            }

            return this.device;
        } catch (error: any) {
            // If filter fails, try acceptAllDevices
            if (error.name === 'NotFoundError') {
                this.device = await navigator.bluetooth.requestDevice({
                    acceptAllDevices: true,
                    optionalServices: [
                        0x18F0,
                        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
                        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                        '000018f0-0000-1000-8000-00805f9b34fb',
                    ]
                });

                if (!this.device) {
                    throw new Error('No printer selected.');
                }
                return this.device;
            }
            throw error;
        }
    }

    /**
     * Connect to the selected printer device
     */
    async connect(): Promise<void> {
        if (!this.device) {
            throw new Error('No device selected. Please scan first.');
        }

        try {
            this.server = await this.device.gatt!.connect();

            // Try common service UUIDs
            const SERVICE_UUIDS = [
                0x18F0,
                'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
                '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                '000018f0-0000-1000-8000-00805f9b34fb',
            ];

            let service: BluetoothRemoteGATTService | null = null;

            for (const uuid of SERVICE_UUIDS) {
                try {
                    service = await this.server.getPrimaryService(uuid);
                    if (service) break;
                } catch {
                    continue;
                }
            }

            // If no known service, scan all services
            if (!service) {
                const services = await this.server.getPrimaryServices();
                for (const s of services) {
                    try {
                        const chars = await s.getCharacteristics();
                        for (const c of chars) {
                            if (c.properties.write || c.properties.writeWithoutResponse) {
                                service = s;
                                this.characteristic = c;
                                break;
                            }
                        }
                        if (this.characteristic) break;
                    } catch {
                        continue;
                    }
                }
            }

            // Get writable characteristic
            if (service && !this.characteristic) {
                const CHAR_UUIDS = [
                    0x2AF1,
                    'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
                ];

                for (const uuid of CHAR_UUIDS) {
                    try {
                        this.characteristic = await service.getCharacteristic(uuid);
                        if (this.characteristic) break;
                    } catch {
                        continue;
                    }
                }

                // If no known characteristic, find any writable one
                if (!this.characteristic) {
                    const chars = await service.getCharacteristics();
                    for (const c of chars) {
                        if (c.properties.write || c.properties.writeWithoutResponse) {
                            this.characteristic = c;
                            break;
                        }
                    }
                }
            }

            if (!this.characteristic) {
                throw new Error('Could not find printer characteristic.');
            }

            this.isConnected = true;
            this.reconnectAttempts = 0;

            // Listen for disconnection and auto-reconnect
            this.device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this));

            // Start keep-alive to maintain connection
            this.startKeepAlive();

        } catch (error) {
            console.error('Failed to connect:', error);
            throw error;
        }
    }

    /**
     * Handle disconnection event
     */
    private handleDisconnect(): void {
        console.log('Printer disconnected');
        this.isConnected = false;
        this.server = null;
        this.characteristic = null;
        this.stopKeepAlive();
    }

    /**
     * Ensure printer is connected before operations
     */
    async ensureConnected(): Promise<void> {
        if (this.isConnected && this.characteristic) {
            return;
        }

        if (!this.device) {
            throw new Error('No printer device. Please scan for printers first.');
        }

        if (this.isReconnecting) {
            // Wait for ongoing reconnection
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (this.isConnected) return;
            throw new Error('Reconnection in progress');
        }

        this.isReconnecting = true;
        console.log('Attempting to reconnect to printer...');

        try {
            // Wait a bit before reconnecting
            await new Promise(resolve => setTimeout(resolve, 500));
            await this.connect();
            console.log('Reconnected to printer successfully');
        } catch (error) {
            this.reconnectAttempts++;
            console.error(`Reconnect attempt ${this.reconnectAttempts} failed:`, error);

            if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
                this.reconnectAttempts = 0;
                throw new Error('Failed to reconnect after multiple attempts. Please reconnect manually.');
            }
            throw error;
        } finally {
            this.isReconnecting = false;
        }
    }

    /**
     * Disconnect from the printer
     */
    async disconnect(): Promise<void> {
        this.stopKeepAlive();
        if (this.server && this.server.connected) {
            this.server.disconnect();
            this.isConnected = false;
            this.server = null;
            this.characteristic = null;
        }
    }

    /**
     * Write data to printer in chunks with auto-reconnect
     */
    private async writeData(data: Uint8Array): Promise<void> {
        // Ensure connected before writing
        await this.ensureConnected();

        if (!this.characteristic) {
            throw new Error('Printer not connected');
        }

        const CHUNK_SIZE = 100;
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
            const chunk = data.slice(i, i + CHUNK_SIZE);
            try {
                await this.characteristic.writeValue(chunk);
            } catch (error: any) {
                // If write fails, try to reconnect once
                if (error.message?.includes('GATT') || !this.isConnected) {
                    console.log('Write failed, attempting reconnection...');
                    await this.ensureConnected();
                    if (this.characteristic) {
                        await this.characteristic.writeValue(chunk);
                    }
                } else {
                    throw error;
                }
            }
            await new Promise(resolve => setTimeout(resolve, 30));
        }
    }

    /**
     * Initialize printer
     */
    async initialize(): Promise<void> {
        await this.writeData(new Uint8Array([this.ESC, 0x40]));
    }

    /**
     * Print text with optional formatting
     */
    async printText(text: string, options?: {
        align?: 'left' | 'center' | 'right';
        bold?: boolean;
        doubleWidth?: boolean;
        doubleHeight?: boolean;
    }): Promise<void> {
        const commands: number[] = [];
        const encoder = new TextEncoder();

        // Set alignment
        if (options?.align) {
            const alignMap = { left: 0, center: 1, right: 2 };
            commands.push(this.ESC, 0x61, alignMap[options.align]);
        }

        // Set text style
        let style = 0;
        if (options?.bold) style |= 0x08;
        if (options?.doubleWidth) style |= 0x20;
        if (options?.doubleHeight) style |= 0x10;
        commands.push(this.ESC, 0x21, style);

        // Add text
        const textBytes = encoder.encode(text);
        commands.push(...textBytes);

        // Reset style
        commands.push(this.ESC, 0x21, 0x00);

        await this.writeData(new Uint8Array(commands));
    }

    /**
     * Print a line separator
     */
    async printLine(char: string = '-'): Promise<void> {
        const line = char.repeat(32) + '\n';
        await this.printText(line);
    }

    /**
     * Feed paper
     */
    async feed(lines: number = 1): Promise<void> {
        await this.writeData(new Uint8Array([this.ESC, 0x64, lines]));
    }

    /**
     * Cut paper
     */
    async cut(): Promise<void> {
        await this.writeData(new Uint8Array([this.GS, 0x56, 0x00]));
    }

    /**
     * Print image from data URL
     */
    async printImage(imageDataUrl: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = async () => {
                try {
                    const scale = this.PAPER_WIDTH / img.width;
                    const canvas = document.createElement('canvas');
                    canvas.width = this.PAPER_WIDTH;
                    canvas.height = Math.round(img.height * scale);

                    const ctx = canvas.getContext('2d')!;
                    ctx.fillStyle = '#FFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const bitmap = this.convertToBitmap(imageData);
                    await this.printBitmap(bitmap, canvas.width, canvas.height);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = imageDataUrl;
        });
    }

    /**
     * Convert image data to monochrome bitmap
     */
    private convertToBitmap(imageData: ImageData): Uint8Array {
        const { width, height, data } = imageData;
        const bytesPerLine = Math.ceil(width / 8);
        const bitmap = new Uint8Array(bytesPerLine * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                const v = 0.299 * r + 0.587 * g + 0.114 * b;
                if (v < 128) {
                    bitmap[y * bytesPerLine + (x >> 3)] |= (0x80 >> (x & 0x7));
                }
            }
        }
        return bitmap;
    }

    /**
     * Print bitmap data
     */
    private async printBitmap(bitmap: Uint8Array, width: number, height: number): Promise<void> {
        const bytesPerLine = Math.ceil(width / 8);
        const LINES_PER_BLOCK = 8;

        for (let y = 0; y < height; y += LINES_PER_BLOCK) {
            const blockLines = Math.min(LINES_PER_BLOCK, height - y);
            const xL = bytesPerLine & 0xFF;
            const xH = (bytesPerLine >> 8) & 0xFF;
            const yL = blockLines & 0xFF;
            const yH = (blockLines >> 8) & 0xFF;

            const header = new Uint8Array([this.GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
            const sliceStart = y * bytesPerLine;
            const sliceEnd = sliceStart + bytesPerLine * blockLines;
            const blockData = bitmap.slice(sliceStart, sliceEnd);

            const command = new Uint8Array(header.length + blockData.length);
            command.set(header, 0);
            command.set(blockData, header.length);

            await this.writeData(command);
        }
    }

    /**
     * Print a complete receipt
     */
    async printReceipt(receipt: {
        storeName: string;
        storeAddress?: string;
        storePhone?: string;
        items: Array<{ name: string; qty: number; price: number }>;
        subtotal: number;
        tax?: number;
        total: number;
        paymentMethod?: string;
        invoiceNo?: string;
        date?: Date;
        logoUrl?: string;
    }): Promise<void> {
        await this.initialize();

        // Print Logo if provided
        if (receipt.logoUrl) {
            try {
                // Ensure center alignment for logo
                await this.writeData(new Uint8Array([this.ESC, 0x61, 0x01]));
                await this.printImage(receipt.logoUrl);
            } catch (e) {
                console.error("Failed to print logo", e);
            }
        }

        // Store Header
        await this.printText(receipt.storeName + '\n', { align: 'center', bold: true, doubleWidth: true });

        if (receipt.storeAddress) {
            await this.printText(receipt.storeAddress + '\n', { align: 'center' });
        }
        if (receipt.storePhone) {
            await this.printText('Ph: ' + receipt.storePhone + '\n', { align: 'center' });
        }

        await this.printLine('=');

        // Invoice info
        const date = receipt.date || new Date();
        await this.printText(`Date: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}\n`, { align: 'center' });
        if (receipt.invoiceNo) {
            await this.printText(`Invoice: ${receipt.invoiceNo}\n`, { align: 'center' });
        }

        await this.printLine('-');

        // Column headers
        // Item: 16 chars, Qty: 5 chars, Price: 11 chars => Total 32
        const headerItem = 'Item'.padEnd(16);
        const headerQty = 'Qty'.padStart(5);
        const headerPrice = 'Price'.padStart(11);
        await this.printText(`${headerItem}${headerQty}${headerPrice}\n`, { bold: true, align: 'center' });
        await this.printLine('-');

        // Items
        for (const item of receipt.items) {
            const name = item.name.substring(0, 16).padEnd(16);
            const qty = item.qty.toString().padStart(5);
            const price = ('Rs.' + item.price.toFixed(0)).padStart(11);
            await this.printText(`${name}${qty}${price}\n`, { align: 'center' });
        }

        await this.printLine('-');

        // Totals - formatted to align specific labels and values
        // We want the value to always be at the right edge (char 32)
        // And the label to be to the left of it.

        const formatTotalLine = (label: string, value: number) => {
            const valueStr = `Rs.${value.toFixed(0)}`;
            const labelStr = label;
            // Calculate padding needed
            const padding = 32 - labelStr.length - valueStr.length;
            if (padding < 0) {
                // Truncate label if needed? Or just print messy
                return `${labelStr.substring(0, 10)}... ${valueStr}\n`;
            }
            return `${labelStr}${' '.repeat(padding)}${valueStr}\n`;
        };

        // Final Total
        await this.printText(formatTotalLine('TOTAL:', receipt.total), { bold: true, align: 'center' });

        // Paid By - Integrated right below Total
        if (receipt.paymentMethod) {
            const label = "Paid:"; // Shortened label to save space
            const value = receipt.paymentMethod.toUpperCase();

            // Format: "Paid: ................ CASH"
            const padding = 32 - label.length - value.length;
            const line = `${label}${' '.repeat(Math.max(0, padding))}${value}\n`;

            await this.printText(line, { align: 'center' });
        }

        await this.printText('\n'); // Small spacer before Thank You

        await this.printText('Thank You!\n', { align: 'center', bold: true });
        // Removed "Visit Again"

        await this.feed(4);
        await this.cut();
    }

    /**
     * Print test page
     */
    async printTestPage(storeName: string = 'My Store'): Promise<void> {
        await this.initialize();

        await this.printText('TEST PRINT\n', { align: 'center', bold: true, doubleWidth: true, doubleHeight: true });
        await this.printLine('=');
        await this.printText(`Store: ${storeName}\n`);
        await this.printText(`Date: ${new Date().toLocaleString()}\n`);
        await this.printText(`Printer: ${this.device?.name || 'Unknown'}\n`);
        await this.printLine('-');
        await this.printText('Printer Connected!\n', { align: 'center', bold: true });
        await this.printText('55mm Thermal Ready\n', { align: 'center' });
        await this.printLine('=');

        await this.feed(4);
        await this.cut();
    }
}

// Singleton instance for global use
let printerInstance: ThermalPrinter | null = null;

export function getPrinter(): ThermalPrinter {
    if (!printerInstance) {
        printerInstance = new ThermalPrinter();
    }
    return printerInstance;
}

export function setPrinter(printer: ThermalPrinter): void {
    printerInstance = printer;
}

export default ThermalPrinter;
