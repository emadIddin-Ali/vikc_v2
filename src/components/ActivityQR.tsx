import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors, font, radius } from '@/theme/tokens';

/** Full-screen modal showing an activity's QR code for youth to scan. */
export function ActivityQR({ token, title, onClose }: { token: string; title: string; onClose: () => void }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>Skanna för att checka in</Text>
          <View style={styles.qrWrap}>
            <QRCode value={token} size={220} backgroundColor="#ffffff" color={colors.ink} />
          </View>
          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Stäng</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(23,18,38,0.6)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  card: { backgroundColor: colors.white, borderRadius: radius.hero, padding: 24, alignItems: 'center', width: '100%', maxWidth: 340 },
  title: { fontFamily: font.bold, fontSize: 18, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 2, marginBottom: 18 },
  qrWrap: { padding: 16, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.inputBorder },
  close: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 40, borderRadius: 14, backgroundColor: colors.ink },
  closeText: { fontFamily: font.semibold, fontSize: 14, color: colors.white },
});
