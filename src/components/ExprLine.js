// An expression being typed: editor pieces plus a blinking cursor.
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, mono } from '../theme';

const SPECIAL = {
  '𝐂': { s: 'C', style: 'comb' },
  '𝐏': { s: 'P', style: 'comb' },
  and: { s: ' and ' },
  or: { s: ' or ' },
  xor: { s: ' xor ' },
  xnor: { s: ' xnor ' },
};

// A thin gap keeps "2" followed by "10^(" from reading as 210.
const needsGap = (pieces, i) => i > 0 && pieces[i].length > 1 && /^\d/.test(pieces[i]) && /^[\d.]$/.test(pieces[i - 1]);

export default function ExprLine({ input, size = 20, color = colors.lcdInk, style }) {
  const { pieces, cursor } = input;
  const items = [];
  pieces.forEach((p, i) => {
    if (i === cursor) items.push(<Cursor key="cursor" size={size} />);
    const sp = SPECIAL[p];
    items.push(
      <Text
        key={i}
        style={[
          { fontSize: size, color, fontFamily: mono },
          needsGap(pieces, i) && { marginLeft: size * 0.3 },
          sp && sp.style && styles[sp.style],
        ]}
      >
        {sp ? sp.s : p}
      </Text>,
    );
  });
  if (cursor === pieces.length) items.push(<Cursor key="cursor" size={size} />);
  return <View style={[styles.row, { minHeight: size * 1.35 }, style]}>{items}</View>;
}

export function Cursor({ size }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 1, delay: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1, delay: 500, useNativeDriver: true }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [opacity]);
  return <Animated.View style={[styles.cursor, { height: size * 1.15, opacity }]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  cursor: { width: 2, backgroundColor: colors.lcdInk, marginHorizontal: -1 },
  comb: { fontWeight: '800', fontStyle: 'italic' },
});
