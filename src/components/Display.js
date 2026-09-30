// The LCD-style screen: status flags, the current mode's content and soft keys.
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, mono } from '../theme';
import ExprLine, { Cursor } from './ExprLine';
import MathRun from './MathRun';

const Display = forwardRef(function Display({ screen, scale, onSoft, onField, onCell }, ref) {
  const scrollRef = useRef(null);
  const offset = useRef(0);
  const viewHeight = useRef(0);

  useImperativeHandle(ref, () => ({
    scrollBy(dir) {
      scrollRef.current?.scrollTo({ y: Math.max(0, offset.current + dir * 44 * scale), animated: true });
    },
  }));

  const { body, status, soft } = screen;
  const fs = (n) => n * scale;

  // Keep the active row / cell visible, scrolling only when it is off screen.
  const onActiveLayout = (e) => {
    const { y, height } = e.nativeEvent.layout;
    const top = offset.current;
    const margin = fs(36);
    let target = null;
    if (y - margin < top) target = y - margin;
    else if (y + height + margin > top + viewHeight.current) target = y + height + margin - viewHeight.current;
    if (target !== null) scrollRef.current?.scrollTo({ y: Math.max(0, target), animated: false });
  };

  let content;
  switch (body.kind) {
    case 'comp':
      content = <CompBody body={body} fs={fs} />;
      break;
    case 'form':
      content = <FormBody body={body} fs={fs} onField={onField} onActiveLayout={onActiveLayout} />;
      break;
    case 'list':
      content = <ListBody body={body} fs={fs} />;
      break;
    case 'table':
      content = <TableBody body={body} fs={fs} />;
      break;
    case 'stat':
      content = <StatBody body={body} fs={fs} onCell={onCell} onActiveLayout={onActiveLayout} />;
      break;
    case 'base':
      content = <BaseBody body={body} fs={fs} />;
      break;
    default:
      content = null;
  }

  const fill = body.kind === 'comp' || body.kind === 'base';
  return (
    <View style={styles.screen}>
      <StatusRow status={status} fs={fs} />
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, fill && styles.fill]}
        onLayout={(e) => { viewHeight.current = e.nativeEvent.layout.height; }}
        onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={32}
        onContentSizeChange={() => { if (fill) scrollRef.current?.scrollToEnd({ animated: false }); }}
      >
        {content}
      </ScrollView>
      {soft.length > 0 && <SoftKeys soft={soft} fs={fs} dense={body.kind === 'base'} onSoft={onSoft} />}
    </View>
  );
});

export default Display;

function StatusRow({ status, fs }) {
  const flag = (on, label, inverted) =>
    on ? <Text key={label} style={[styles.flag, { fontSize: fs(10) }, inverted && styles.flagInv]}>{label}</Text> : null;
  return (
    <View style={styles.status}>
      {flag(status.shift, 'S', true)}
      {flag(status.alpha, 'A', true)}
      {flag(status.hyp, 'hyp')}
      {flag(status.sto, 'STO')}
      {flag(status.memory, 'M')}
      {flag(true, status.angle)}
      {flag(!!status.format, status.format)}
      <View style={{ flex: 1 }} />
      {flag(!!status.mode, status.mode)}
    </View>
  );
}

function CompBody({ body, fs }) {
  const r = body.result;
  let result = null;
  if (r && r.error) {
    result = (
      <View>
        <Text style={[styles.error, { fontSize: fs(22) }]}>{r.error}</Text>
        <Text style={[styles.hint, { fontSize: fs(12) }]}>AC: clear · ◀ ▶ / DEL: edit</Text>
      </View>
    );
  } else if (r && r.multi) {
    result = r.multi.map(([label, run]) => (
      <View key={label} style={styles.multi}>
        <Text style={[styles.dim, { fontSize: fs(22) }]}>{label}=</Text>
        <MathRun run={run} size={fs(26)} align="right" />
      </View>
    ));
  } else if (r) {
    result = (
      <View style={styles.resultRow}>
        {r.stored && <Text style={[styles.dim, { fontSize: fs(16) }]}>→{r.stored}  </Text>}
        <MathRun run={r.run} size={fs(36)} align="right" style={{ flexShrink: 1 }} />
      </View>
    );
  }
  return (
    <>
      <ExprLine input={body.input} size={fs(20)} color={body.dim ? '#2e3833' : colors.lcdInk} />
      <View style={styles.result}>{result}</View>
    </>
  );
}

function Title({ text, fs }) {
  return <Text style={[styles.title, { fontSize: fs(11) }]}>{text}</Text>;
}

function ErrorLine({ error, fs }) {
  return error ? <Text style={[styles.error, { fontSize: fs(14) }]}>{error}</Text> : null;
}

function FormBody({ body, fs, onField, onActiveLayout }) {
  const grid = body.grid;
  return (
    <View>
      <Title text={body.title} fs={fs} />
      <ErrorLine error={body.error} fs={fs} />
      <View style={grid ? styles.grid : null}>
        {body.rows.map((row, i) => (
          <Pressable
            key={`${i}${row.active ? 'a' : ''}`}
            onPress={() => onField(i)}
            onLayout={row.active ? onActiveLayout : undefined}
            style={[styles.frow, grid && { width: `${100 / grid}%` }, row.active && styles.active]}
          >
            <Text style={[styles.dim, { fontSize: fs(14) }]}>{grid ? row.label : `${row.label} =`}</Text>
            <View style={styles.fval}>
              {row.input ? (
                <ExprLine input={row.input} size={fs(16)} style={styles.rightWrap} />
              ) : (
                <MathRun run={row.run} size={fs(17)} align="right" />
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ListBody({ body, fs }) {
  return (
    <View>
      <Title text={body.title} fs={fs} />
      {body.rows.map((row, i) => (
        <View key={i} style={[styles.lrow, i === body.rows.length - 1 && styles.last]}>
          <Text style={[styles.dim, { fontSize: fs(17) }]}>{row.label ? `${row.label} =` : ''}</Text>
          <MathRun run={row.run} size={fs(21)} align="right" style={{ flexShrink: 1 }} />
        </View>
      ))}
    </View>
  );
}

function TableBody({ body, fs }) {
  return (
    <View>
      <Title text={body.title} fs={fs} />
      <View style={styles.trow}>
        {body.head.map((h) => (
          <Text key={h} style={[styles.th, { fontSize: fs(12) }]}>{h}</Text>
        ))}
      </View>
      {body.rows.map((row, i) => (
        <View key={i} style={styles.trow}>
          {row.map((cell, j) => (
            <MathRun key={j} run={cell} size={fs(15)} align="right" style={styles.td} />
          ))}
        </View>
      ))}
    </View>
  );
}

function StatBody({ body, fs, onCell, onActiveLayout }) {
  return (
    <View>
      <Title text={body.title} fs={fs} />
      <ErrorLine error={body.error} fs={fs} />
      <View style={styles.trow}>
        <Text style={[styles.th, styles.idx, { fontSize: fs(12) }]} />
        <Text style={[styles.th, { fontSize: fs(12) }]}>x</Text>
        {body.two && <Text style={[styles.th, { fontSize: fs(12) }]}>y</Text>}
      </View>
      {body.rows.map((cells, r) => {
        const active = cells.some((c) => c.active);
        return (
          <View
            key={`${r}${active ? 'a' : ''}`}
            style={styles.trow}
            onLayout={active ? onActiveLayout : undefined}
          >
            <Text style={[styles.dim, styles.idx, { fontSize: fs(13) }]}>{r + 1}</Text>
            {cells.map((cell, c) => (
              <Pressable key={c} onPress={() => onCell(r, c)} style={[styles.td, styles.cell, cell.active && styles.active]}>
                {cell.input ? (
                  <ExprLine input={cell.input} size={fs(15)} style={styles.rightWrap} />
                ) : (
                  <View style={styles.cellRow}>
                    <MathRun run={cell.run} size={fs(15)} align="right" />
                    {cell.active && <Cursor size={fs(15)} />}
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function BaseBody({ body, fs }) {
  return (
    <>
      <ExprLine input={body.input} size={fs(20)} color={body.dim ? '#2e3833' : colors.lcdInk} />
      <View style={styles.result}>
        {body.error && <Text style={[styles.error, { fontSize: fs(22) }]}>{body.error}</Text>}
        {body.value !== null && (
          <>
            <Text style={[styles.baseValue, { fontSize: fs(34) }]} adjustsFontSizeToFit numberOfLines={2}>
              {body.value}
            </Text>
            {body.others.map(([name, v]) => (
              <View key={name} style={styles.baseRow}>
                <Text style={[styles.baseName, { fontSize: fs(11) }]}>{name}</Text>
                <Text style={[styles.baseOther, { fontSize: fs(11) }]}>{v}</Text>
              </View>
            ))}
          </>
        )}
      </View>
    </>
  );
}

function SoftKeys({ soft, fs, dense, onSoft }) {
  return (
    <View style={[styles.softkeys, dense && styles.softDense]}>
      {soft.map((s, i) => (
        <Pressable
          key={i}
          disabled={s.disabled}
          onPress={() => onSoft(i)}
          style={({ pressed }) => [
            styles.soft,
            dense && styles.softKeyDense,
            (pressed || s.on) && styles.softOn,
            s.disabled && styles.softDisabled,
          ]}
        >
          {({ pressed }) => (
            <Text style={[styles.softText, { fontSize: fs(dense ? 11 : 12) }, (pressed || s.on) && styles.softTextOn]}>
              {s.label}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.lcd,
    borderRadius: 12,
    borderWidth: 6,
    borderColor: colors.bezel,
    overflow: 'hidden',
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 18, paddingHorizontal: 8, paddingTop: 3 },
  flag: { fontWeight: '700', color: colors.lcdInk },
  flagInv: { backgroundColor: colors.lcdInk, color: colors.lcd, paddingHorizontal: 3, borderRadius: 2, overflow: 'hidden' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 6 },
  fill: { flexGrow: 1, justifyContent: 'space-between' },
  result: { paddingTop: 4 },
  resultRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  multi: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { fontWeight: '700', color: colors.lcdInk },
  hint: { color: colors.lcdDim, marginTop: 4 },
  dim: { color: colors.lcdDim },
  title: {
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.lcdDim,
    borderBottomWidth: 1,
    borderBottomColor: colors.lcdLine,
    paddingBottom: 3,
    marginBottom: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  frow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  active: { backgroundColor: colors.lcdActive, borderColor: colors.lcdInk },
  fval: { flex: 1, alignItems: 'flex-end' },
  rightWrap: { justifyContent: 'flex-end' },
  lrow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: colors.lcdLine,
  },
  last: { borderBottomWidth: 0 },
  trow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: colors.lcdLine,
  },
  th: { flex: 1, textAlign: 'right', color: colors.lcdDim, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2 },
  td: { flex: 1, paddingHorizontal: 6, paddingVertical: 4 },
  idx: { flex: 0, width: 32, textAlign: 'left' },
  cell: { minHeight: 30, justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  cellRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  baseValue: { textAlign: 'right', color: colors.lcdInk, fontFamily: mono },
  baseRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  baseName: { fontWeight: '700', color: colors.lcdDim, fontFamily: mono },
  baseOther: { color: colors.lcdDim, fontFamily: mono },
  softkeys: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: colors.lcdLine,
  },
  softDense: { gap: 3 },
  soft: {
    flexGrow: 1,
    minWidth: 52,
    borderWidth: 1.5,
    borderColor: colors.lcdInk,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  softKeyDense: { minWidth: 0, flexBasis: '11%', paddingVertical: 3, paddingHorizontal: 0 },
  softOn: { backgroundColor: colors.lcdInk },
  softDisabled: { opacity: 0.3 },
  softText: { color: colors.lcdInk, fontWeight: '700' },
  softTextOn: { color: colors.lcd },
});
