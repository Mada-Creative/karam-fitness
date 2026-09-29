import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KEYS, LAYOUT } from '../core/keys';
import { colors } from '../theme';

export default function Keypad({ shiftOn, alphaOn, scale, onKey, onDir }) {
  const gap = 7 * scale;
  const key = (id) => <Key key={id} id={id} def={KEYS[id]} shiftOn={shiftOn} alphaOn={alphaOn} scale={scale} onKey={onKey} />;
  const row = (ids, i) => <View key={i} style={[styles.row, { gap }]}>{ids.map(key)}</View>;

  return (
    <View style={[styles.keypad, { gap: gap * 1.6 }]}>
      <View style={[styles.fnPad, { gap }]}>
        <View style={[styles.top, { gap }]}>
          <View style={[styles.col, { gap }]}>{LAYOUT.topLeft.map(row)}</View>
          <View style={styles.dpadWrap}>
            <DPad onDir={onDir} scale={scale} />
          </View>
          <View style={[styles.col, { gap }]}>{LAYOUT.topRight.map(row)}</View>
        </View>
        {LAYOUT.fnRows.map(row)}
      </View>
      <View style={[styles.numPad, { gap }]}>{LAYOUT.numRows.map(row)}</View>
    </View>
  );
}

function Key({ id, def, shiftOn, alphaOn, scale, onKey }) {
  const kind = def.kind || 'fn';
  const face = FACE[kind];
  const big = kind === 'num' || kind === 'op' || kind === 'eq';
  const len = def.l.length;
  const labelSize = (big ? (len <= 1 ? 24 : len <= 3 ? 19 : 14) : len > 3 ? 13 : 16) * scale;
  return (
    <Pressable
      onPress={() => onKey(id)}
      style={styles.key}
      accessibilityRole="button"
      accessibilityLabel={def.l}
      hitSlop={2}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.labels, { height: 13 * scale }]}>
            <Text
              numberOfLines={1}
              style={[styles.shiftLabel, { fontSize: 10 * scale }, shiftOn && styles.shiftLabelOn]}
            >
              {def.s ? def.s[0] : ''}
            </Text>
            <Text style={[styles.alphaLabel, { fontSize: 10 * scale }, alphaOn && styles.alphaLabelOn]}>
              {def.al ? def.al[0] : ''}
            </Text>
          </View>
          <View
            style={[
              styles.face,
              face.box,
              (kind === 'shift' && shiftOn) || (kind === 'alpha' && alphaOn) ? styles.engaged : null,
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.faceText, face.text, { fontSize: labelSize }]}
            >
              {def.l}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

function DPad({ onDir, scale }) {
  const btn = (dir, symbol, style) => (
    <Pressable
      key={dir}
      onPress={() => onDir(dir)}
      style={({ pressed }) => [styles.dp, style, pressed && styles.dpPressed]}
      accessibilityRole="button"
      accessibilityLabel={dir}
    >
      <Text style={[styles.dpText, { fontSize: 14 * scale }]}>{symbol}</Text>
    </Pressable>
  );
  return (
    <View style={styles.dpad}>
      {btn('up', '▲', styles.dpUp)}
      {btn('down', '▼', styles.dpDown)}
      {btn('left', '◀', styles.dpLeft)}
      {btn('right', '▶', styles.dpRight)}
    </View>
  );
}

const FACE = {
  fn: { box: { backgroundColor: colors.keyFn }, text: { color: colors.ink } },
  sys: { box: { backgroundColor: colors.keySys }, text: { color: colors.ink } },
  shift: { box: { backgroundColor: colors.shift }, text: { color: colors.shiftInk } },
  alpha: { box: { backgroundColor: colors.alpha }, text: { color: colors.alphaInk } },
  num: { box: { backgroundColor: colors.keyNum, shadowColor: '#8e8b84' }, text: { color: colors.keyNumInk } },
  op: { box: { backgroundColor: colors.keyOp, shadowColor: '#8e8b84' }, text: { color: colors.keyNumInk } },
  warn: { box: { backgroundColor: colors.keyWarn, shadowColor: '#8a3017' }, text: { color: '#fff' } },
  eq: { box: { backgroundColor: colors.keyEq, shadowColor: '#1d4fa3' }, text: { color: '#fff' } },
};

const styles = StyleSheet.create({
  keypad: { flex: 1 },
  fnPad: { flex: 5 },
  numPad: { flex: 5.2 },
  top: { flex: 2, flexDirection: 'row' },
  col: { flex: 2 },
  row: { flex: 1, flexDirection: 'row' },
  key: { flex: 1 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  shiftLabel: { color: colors.shift, fontWeight: '700', flexShrink: 1 },
  shiftLabelOn: { color: '#ffd08a', textShadowColor: 'rgba(244,169,59,0.8)', textShadowRadius: 6 },
  alphaLabel: { color: colors.alpha, fontWeight: '700' },
  alphaLabelOn: { color: '#8ff5ec', textShadowColor: 'rgba(63,208,196,0.8)', textShadowRadius: 6 },
  face: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    shadowColor: '#0c0d10',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  faceText: { fontWeight: '600' },
  pressed: { transform: [{ translateY: 2 }], shadowOpacity: 0, elevation: 0, opacity: 0.85 },
  engaged: { borderWidth: 2, borderColor: '#fff' },
  dpadWrap: { flex: 2, alignItems: 'center', justifyContent: 'center' },
  dpad: {
    height: '100%',
    maxWidth: '100%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#2e333c',
    borderWidth: 1,
    borderColor: '#3b414d',
    shadowColor: '#0c0d10',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  dp: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  dpPressed: { backgroundColor: 'rgba(255,255,255,0.1)' },
  dpText: { color: '#c8cdd6' },
  dpUp: { top: 0, left: '30%', width: '40%', height: '36%', borderTopLeftRadius: 999, borderTopRightRadius: 999 },
  dpDown: { bottom: 0, left: '30%', width: '40%', height: '36%', borderBottomLeftRadius: 999, borderBottomRightRadius: 999 },
  dpLeft: { left: 0, top: '30%', width: '36%', height: '40%', borderTopLeftRadius: 999, borderBottomLeftRadius: 999 },
  dpRight: { right: 0, top: '30%', width: '36%', height: '40%', borderTopRightRadius: 999, borderBottomRightRadius: 999 },
});
