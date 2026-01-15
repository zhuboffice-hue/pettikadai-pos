interface BluetoothRequestDeviceFilter {
    services?: (string | number)[];
    name?: string;
    namePrefix?: string;
    manufacturerId?: number;
    serviceDataUUID?: string | number;
}

interface RequestDeviceOptions {
    filters?: BluetoothRequestDeviceFilter[];
    optionalServices?: (string | number)[];
    acceptAllDevices?: boolean;
}

interface BluetoothRemoteGATTServer {
    device: BluetoothDevice;
    connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: string | number): Promise<BluetoothRemoteGATTService>;
    getPrimaryServices(service?: string | number): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTService {
    uuid: string;
    isPrimary: boolean;
    device: BluetoothDevice;
    getCharacteristic(characteristic: string | number): Promise<BluetoothRemoteGATTCharacteristic>;
    getCharacteristics(characteristic?: string | number): Promise<BluetoothRemoteGATTCharacteristic[]>;
    getIncludedService(service: string | number): Promise<BluetoothRemoteGATTService>;
    getIncludedServices(service?: string | number): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTCharacteristic {
    uuid: string;
    properties: BluetoothCharacteristicProperties;
    value?: DataView;
    getDescriptor(descriptor: string | number): Promise<BluetoothRemoteGATTDescriptor>;
    getDescriptors(descriptor?: string | number): Promise<BluetoothRemoteGATTDescriptor[]>;
    readValue(): Promise<DataView>;
    writeValue(value: BufferSource): Promise<void>;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    addEventListener(type: "characteristicvaluechanged", listener: (this: this, ev: Event) => any): void;
    removeEventListener(type: "characteristicvaluechanged", listener: (this: this, ev: Event) => any): void;
}

interface BluetoothCharacteristicProperties {
    broadcast: boolean;
    read: boolean;
    writeWithoutResponse: boolean;
    write: boolean;
    notify: boolean;
    indicate: boolean;
    authenticatedSignedWrites: boolean;
    reliableWrite: boolean;
    writableAuxiliaries: boolean;
}

interface BluetoothRemoteGATTDescriptor {
    uuid: string;
    characteristic: BluetoothRemoteGATTCharacteristic;
    value?: DataView;
    readValue(): Promise<DataView>;
    writeValue(value: BufferSource): Promise<void>;
}

interface BluetoothDevice extends EventTarget {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
    watchAdvertisements(): Promise<void>;
    unwatchAdvertisements(): void;
    readonly watchingAdvertisements: boolean;
    addEventListener(type: "gattserverdisconnected", listener: (this: this, ev: Event) => any): void;
    addEventListener(type: "advertisementreceived", listener: (this: this, ev: Event) => any): void;
}

interface Bluetooth extends EventTarget {
    getAvailability(): Promise<boolean>;
    requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
}

interface Navigator {
    bluetooth: Bluetooth;
}
