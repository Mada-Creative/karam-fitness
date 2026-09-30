// Bottom sheet for MODE, SETUP, HISTORY, RECALL and the mode sub-menus.
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import ExprLine from './ExprLine';

export default function MenuSheet({ menu, onChoose, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!menu} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.panel, { paddingBottom: insets.bottom + 12 }]} onPress={() => {}}>
          <View style={styles.head}>
            <Text style={styles.title}>{menu ? menu.title : ''}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {menu && menu.items.map((item, i) => (
              <Pressable
                key={i}
                onPress={() => onChoose(i)}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              >
                <View style={[styles.num, i >= 9 && styles.numHidden]}>
                  <Text style={styles.numText}>{i < 9 ? i + 1 : ''}</Text>
                </View>
                <View style={styles.text}>
                  {item.pieces ? (
                    <ExprLine input={{ pieces: item.pieces, cursor: -1 }} size={16} color={colors.ink} />
                  ) : (
                    <Text style={styles.label}>{item.label}</Text>
                  )}
                  {item.hint ? <Text style={styles.hint}>{item.hint}</Text> : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  panel: {
    maxHeight: '75%',
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  title: { color: '#aab2c0', fontWeight: '800', letterSpacing: 1.5, fontSize: 13 },
  close: { color: '#aab2c0', fontSize: 18 },
  list: { paddingHorizontal: 10 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.sheetItem,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  itemPressed: { backgroundColor: '#353b46' },
  num: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.keySys,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numHidden: { opacity: 0 },
  numText: { color: '#cfd5de', fontSize: 12, fontWeight: '700' },
  text: { flex: 1 },
  label: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
