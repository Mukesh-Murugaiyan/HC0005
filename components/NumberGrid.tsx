import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface NumberGridProps {
  selectedValue: string;
  onSelectValue: (val: string) => void;
}

const NUMBERS = [
  '0', '0.5', '1', '1.5', '2',
  '3', '4', '5', '6',
  '7', '8', '9', '10',
  '11', '12', '13', '14',
  '15', '16', '17', '18',
  '19', '20', '25', '30',
  '35', '40', '45',
];

export const NumberGrid: React.FC<NumberGridProps> = ({ selectedValue, onSelectValue }) => {
  return (
    <View style={styles.gridContainer}>
      {NUMBERS.map((num, idx) => {
        const isSelected = num === selectedValue;
        const cleanVal = num.replace('\n', ' ');

        return (
          <TouchableOpacity
            key={idx}
            activeOpacity={0.7}
            onPress={() => onSelectValue(num)}
            style={[
              styles.circleButton,
              isSelected ? styles.selectedCircle : styles.unselectedCircle,
            ]}
          >
            <Text
              style={[
                styles.buttonText,
                isSelected ? styles.selectedText : styles.unselectedText,
                num.includes('\n') && styles.smallText,
              ]}
            >
              {num}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 16,
  },
  circleButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unselectedCircle: {
    backgroundColor: '#404040',
  },
  selectedCircle: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    fontSize: 22,
    fontFamily: 'Platform',
    textAlign: 'center',
  },
  unselectedText: {
    color: '#E1E1E1',
  },
  selectedText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  smallText: {
    fontSize: 14,
    lineHeight: 18,
  },
});
