// Renders a display run (see src/core/mathRuns.js): text, stacked fractions,
// square roots with an overline, exponents and the imaginary unit.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function MathRun({ run, size = 20, color = colors.lcdInk, align = 'left', style }) {
  return (
    <View style={[styles.row, align === 'right' && styles.right, style]}>
      {run.map((part, i) => <Part key={i} part={part} size={size} color={color} />)}
    </View>
  );
}

function Part({ part, size, color }) {
  const text = { fontSize: size, color };
  if (typeof part === 'string') return <Text style={text}>{part}</Text>;
  const line = Math.max(1.5, size * 0.07);
  switch (part.t) {
    case 'frac':
      return (
        <View style={[styles.frac, { marginHorizontal: size * 0.1 }]}>
          <MathRun run={part.n} size={size * 0.8} color={color} />
          <View style={{ alignSelf: 'stretch', height: line, backgroundColor: color, marginVertical: 1 }} />
          <MathRun run={part.d} size={size * 0.8} color={color} />
        </View>
      );
    case 'sqrt':
      return (
        <View style={styles.sqrt}>
          <Text style={text}>√</Text>
          <View style={{ borderTopWidth: line, borderTopColor: color, marginTop: size * 0.1 }}>
            <MathRun run={part.r} size={size} color={color} />
          </View>
        </View>
      );
    case 'sup':
      return <Text style={[text, styles.sup, { fontSize: size * 0.58 }]}>{part.s}</Text>;
    case 'i':
      return <Text style={[text, styles.imag]}>i</Text>;
    case 'err':
      return <Text style={[text, styles.err, { fontSize: size * 0.7 }]}>{part.s}</Text>;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  right: { justifyContent: 'flex-end' },
  frac: { alignItems: 'center' },
  sqrt: { flexDirection: 'row', alignItems: 'flex-start' },
  sup: { alignSelf: 'flex-start' },
  imag: { fontStyle: 'italic', fontFamily: 'serif' },
  err: { fontWeight: '700' },
});
