import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  StyleProp,
  ActivityIndicator,
} from 'react-native';

interface Button3DProps {
  title: string;
  onPress: () => void;
  backgroundColor?: string;
  shadowColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  height?: number;
}

export const Button3D: React.FC<Button3DProps> = ({
  title,
  onPress,
  backgroundColor = '#ddb7ff', // default brand primary bright purple
  shadowColor = '#b76dff',      // default brand primary darker shadow
  textColor = '#400071',       // default brand primary text
  style,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  height = 52,
}) => {
  return (
    <View style={[styles.outerContainer, { height }, style]}>
      {/* 3D bottom shadow layer */}
      <View
        style={[
          styles.shadowLayer,
          {
            backgroundColor: disabled ? '#1b1d1f' : shadowColor,
            borderRadius: 16,
          },
        ]}
      />
      {/* Interactive top layer */}
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.interactiveLayer,
          {
            backgroundColor: disabled ? '#272a2c' : backgroundColor,
            borderRadius: 16,
            top: pressed ? 4 : 0,
            bottom: pressed ? 0 : 4,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <View style={styles.contentRow}>
            {leftIcon && <View style={styles.leftIconWrapper}>{leftIcon}</View>}
            <Text style={[styles.text, { color: disabled ? '#8e8e93' : textColor }]}>
              {title}
            </Text>
            {rightIcon && <View style={styles.rightIconWrapper}>{rightIcon}</View>}
          </View>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'relative',
    width: '100%',
  },
  shadowLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 4,
    bottom: 0,
  },
  interactiveLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  leftIconWrapper: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightIconWrapper: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    fontFamily: 'Inter_900Black',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
});
