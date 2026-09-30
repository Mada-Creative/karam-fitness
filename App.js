import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Animated, BackHandler, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { createCalculator } from './src/core/calculator';
import Display from './src/components/Display';
import Keypad from './src/components/Keypad';
import MenuSheet from './src/components/MenuSheet';
import { colors } from './src/theme';

const STORE_KEY = 'calculator.state.v1';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Calculator />
    </SafeAreaProvider>
  );
}

function Calculator() {
  const [, rerender] = useReducer((n) => n + 1, 0);
  const [toast, setToast] = useState(null);
  const displayRef = useRef(null);
  const { width, height } = useWindowDimensions();
  // Scale type and spacing with the screen, designed at 390pt wide.
  const scale = Math.max(0.8, Math.min(1.25, Math.min(width / 390, height / 844)));

  const calc = useMemo(
    () =>
      createCalculator({
        save: (data) => { AsyncStorage.setItem(STORE_KEY, data).catch(() => {}); },
        clearStorage: () => { AsyncStorage.removeItem(STORE_KEY).catch(() => {}); },
        toast: (message) => setToast({ message, at: Date.now() }),
        scroll: (dir) => displayRef.current?.scrollBy(dir),
      }),
    [],
  );

  useEffect(() => calc.subscribe(rerender), [calc]);

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then((raw) => calc.load(raw)).catch(() => {});
  }, [calc]);

  // Android back button: step back through menus and screens, then exit.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => calc.back());
    return () => sub.remove();
  }, [calc]);

  const screen = calc.getScreen();

  const tap = useCallback(() => {
    if (screen.vibrate) Haptics.selectionAsync().catch(() => {});
  }, [screen.vibrate]);

  const onKey = useCallback((id) => { tap(); calc.pressKey(id); }, [calc, tap]);
  const onDir = useCallback((dir) => { tap(); calc.pressDir(dir); }, [calc, tap]);
  const onSoft = useCallback((i) => { tap(); calc.pressSoft(i); }, [calc, tap]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.calc, { paddingHorizontal: 12 * scale, gap: 10 * scale }]}>
        <View style={styles.brand}>
          <Text style={[styles.brandName, { fontSize: 13 * scale }]}>CALCULATOR</Text>
          <Text style={[styles.brandSub, { fontSize: 9 * scale }]}>SCIENTIFIC · NATURAL</Text>
        </View>
        <View style={[styles.screen, { height: Math.round(height * 0.3) }]}>
          <Display
            ref={displayRef}
            screen={screen}
            scale={scale}
            onSoft={onSoft}
            onField={(i) => calc.tapField(i)}
            onCell={(r, c) => calc.tapCell(r, c)}
          />
        </View>
        <Keypad shiftOn={screen.shift} alphaOn={screen.alpha} scale={scale} onKey={onKey} onDir={onDir} />
      </View>
      <MenuSheet
        menu={screen.menu}
        onChoose={(i) => { tap(); calc.chooseMenu(i); }}
        onClose={() => calc.closeMenu()}
      />
      <Toast toast={toast} />
    </SafeAreaView>
  );
}

function Toast({ toast }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toast) return undefined;
    opacity.setValue(1);
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }, 1600);
    return () => clearTimeout(t);
  }, [toast, opacity]);
  if (!toast) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
      <Text style={styles.toastText}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.body },
  calc: { flex: 1, paddingTop: 6, paddingBottom: 8 },
  brand: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  brandName: { fontWeight: '800', letterSpacing: 3.5, color: '#d9dde4' },
  brandSub: { letterSpacing: 2, color: '#7d8594' },
  screen: { minHeight: 170 },
  toast: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: colors.ink,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toastText: { color: '#16181d', fontWeight: '600', fontSize: 14 },
});
