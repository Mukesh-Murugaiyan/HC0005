import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface PinInputProps {
  pin: string;
  onPinChange: (text: string) => void;
  onConnect: () => void;
  isConnected: boolean;
  expiresInSeconds?: number;
}

export const PinInput: React.FC<PinInputProps> = ({
  pin,
  onPinChange,
  onConnect,
  isConnected,
  expiresInSeconds = 10,
}) => {
  const inputRef = React.useRef<TextInput>(null);

  const handleBoxPress = () => {
    inputRef.current?.focus();
  };

  const digits = pin.split('');

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Enter 6-Digit PIN</Text>
        <View style={styles.secureBadge}>
          <Text style={styles.secureIcon}>🛡️</Text>
          <Text style={styles.secureText}>Secure</Text>
        </View>
      </View>

      {/* Hidden real TextInput */}
      <TextInput
        ref={inputRef}
        value={pin}
        onChangeText={(text) => {
          if (text.length <= 6) {
            onPinChange(text);
          }
        }}
        keyboardType="number-pad"
        maxLength={6}
        style={styles.hiddenInput}
      />

      {/* 6 Digit Box Container */}
      <TouchableOpacity activeOpacity={0.9} onPress={handleBoxPress} style={styles.boxesRow}>
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const char = digits[index];
          const hasVal = char !== undefined;

          return (
            <View key={index} style={[styles.pinBox, hasVal && styles.pinBoxFilled]}>
              <Text style={styles.pinText}>
                {hasVal ? char : '●'}
              </Text>
            </View>
          );
        })}
      </TouchableOpacity>

      {/* Connect Button */}
      <TouchableOpacity activeOpacity={0.8} style={styles.connectButton} onPress={onConnect}>
        <IconSymbol size={20} name="paperplane.fill" color="#FFFFFF" style={styles.btnIcon} />
        <Text style={styles.connectButtonText}>{isConnected ? 'Disconnect' : 'Connect'}</Text>
      </TouchableOpacity>

      {/* Expiry Subtext */}
      <Text style={styles.expiryText}>Expires in {expiresInSeconds} s</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#28282B',
    borderRadius: 20,
    padding: 20,
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secureIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  secureText: {
    color: '#B026FF',
    fontSize: 14,
    fontWeight: '600',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  boxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  pinBox: {
    width: 46,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3D3D42',
    backgroundColor: '#202023',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinBoxFilled: {
    borderColor: '#55555C',
    backgroundColor: '#2A2A2E',
  },
  pinText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  connectButton: {
    backgroundColor: '#2F65FF',
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  btnIcon: {
    marginRight: 8,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  expiryText: {
    color: '#A0A0A5',
    fontSize: 13,
    textAlign: 'center',
  },
});
