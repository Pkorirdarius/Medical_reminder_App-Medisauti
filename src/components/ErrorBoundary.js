import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RADIUS, FONT } from '../utils/constants';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.warn('ErrorBoundary caught:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#C62828" />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>An unexpected error occurred. Please restart the app.</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ hasError: false })}
            activeOpacity={0.7}
          >
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#f9faf5',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  title: {
    fontSize: 20, fontFamily: FONT.headline || 'System', color: '#1a1c1a',
    marginTop: 16, textAlign: 'center',
  },
  subtitle: {
    fontSize: 14, fontFamily: FONT.body || 'System', color: '#6f7a74',
    marginTop: 8, textAlign: 'center', lineHeight: 20,
  },
  btn: {
    marginTop: 24, backgroundColor: '#00513f',
    borderRadius: RADIUS.xl || 20, paddingHorizontal: 24, paddingVertical: 12,
  },
  btnText: {
    fontSize: 15, fontFamily: FONT.bodySemiBold || 'System', color: '#fff',
  },
});
