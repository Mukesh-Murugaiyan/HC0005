import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { BluetoothDevice, bluetoothService, ConnectionStatus } from '@/services/bluetooth';

export function useBluetooth() {
  const [status, setStatus] = useState<ConnectionStatus>(bluetoothService.getStatus());
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(
    bluetoothService.getConnectedDevice()
  );
  const [isPairingModeEnabled, setIsPairingModeEnabled] = useState<boolean>(
    bluetoothService.getIsPairingModeEnabled()
  );
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [myDeviceName, setMyDeviceName] = useState<string>('My Device (HC-0.5)');
  const [receivedData, setReceivedData] = useState<string>('');

  useEffect(() => {
    const unsubscribeStatus = bluetoothService.subscribe((newStatus, device, isPairingMode) => {
      setStatus(newStatus);
      setConnectedDevice(device);
      setIsPairingModeEnabled(isPairingMode);
    });

    const unsubscribeData = bluetoothService.onData((data) => {
      console.log('[HOOK] Bluetooth response received:', data);
      setReceivedData(data);
    });

    // Auto-connect / resume server listening on app launch (no auto-scan)
    bluetoothService.getLocalDeviceName().then((name) => {
      if (name) setMyDeviceName(name);
    });
    bluetoothService.autoConnectLastDevice().catch((err: any) => {
      console.warn('Auto-connect attempt error:', err);
    });

    // Handle AppState changes (e.g. app closed/minimized and opened again)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[BT Lifecycle] App foregrounded — verifying Bluetooth connection state');
        bluetoothService.autoConnectLastDevice().catch((err: any) => {
          console.warn('Auto-reconnect on app resume error:', err);
        });
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      unsubscribeStatus();
      unsubscribeData();
      appStateSubscription.remove();
    };
  }, []);

  const scan = async () => {
    setIsScanning(true);
    try {
      const list = await bluetoothService.scanForDevices();
      setDevices(list);
    } catch (e: any) {
      console.warn('Scan failed:', e);
    } finally {
      setIsScanning(false);
    }
  };

  const enablePairingMode = async () => {
    return await bluetoothService.enablePairingMode();
  };

  const disablePairingMode = () => {
    bluetoothService.disablePairingMode();
  };

  const togglePairingMode = async () => {
    if (isPairingModeEnabled) {
      disablePairingMode();
      return false;
    } else {
      return await enablePairingMode();
    }
  };

  const pairDevice = async (device: BluetoothDevice) => {
    const res = await bluetoothService.pairDevice(device);
    await scan();
    return res;
  };

  const connect = async (device?: BluetoothDevice, pin: string = '123456') => {
    const target = device || devices[0];
    if (!target) {
      console.warn('No Bluetooth device selected or found.');
      return false;
    }
    return await bluetoothService.connect(target);
  };

  const disconnect = async () => {
    await bluetoothService.disconnect();
  };

  const sendData = async (data: string) => {
    return await bluetoothService.sendData(data);
  };

  const requestPermissions = async () => {
    return await bluetoothService.requestPermissions();
  };

  return {
    status,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    connectedDevice,
    devices,
    isScanning,
    isPairingModeEnabled,
    myDeviceName,
    receivedData,
    enablePairingMode,
    disablePairingMode,
    togglePairingMode,
    pairDevice,
    scan,
    connect,
    disconnect,
    sendData,
    requestPermissions,
    autoConnectLastDevice: () => bluetoothService.autoConnectLastDevice(),
  };
}
