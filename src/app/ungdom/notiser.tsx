import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon, IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { useMarkNotificationsRead, useNotifications } from '@/hooks/useNotifications';
import { ICON_TINT, colors, font, relativeDate } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function Notiser() {
  const { activeMembership } = useAuth();
  const fid = activeMembership?.forening_id ?? null;
  const { data } = useNotifications(fid);
  const markRead = useMarkNotificationsRead();

  // Opening the screen marks everything read (clears the home bell badge).
  useEffect(() => {
    if (fid) markRead.mutate(fid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid]);

  const notifs = data ?? [];

  return (
    <Screen>
      <Text style={styles.h1}>Notiser</Text>
      {notifs.length === 0 ? (
        <Text style={styles.empty}>Inga notiser än.</Text>
      ) : (
        notifs.map((n) => (
          <Card key={n.id} style={[styles.card, { backgroundColor: n.read ? colors.white : colors.unreadBg }]}>
            <View style={[styles.tile, { backgroundColor: n.tint }]}>
              <Icon name={n.icon as IconName} size={20} color={ICON_TINT[n.icon] ?? colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{n.title}</Text>
              {!!n.body && <Text style={styles.body}>{n.body}</Text>}
              <Text style={styles.time}>{relativeDate(n.created_at)}</Text>
            </View>
            {!n.read && <View style={styles.dot} />}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: font.bold, fontSize: 22, color: colors.ink },
  empty: { fontFamily: font.regular, fontSize: 13, color: colors.muted2, marginTop: 14 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 13, marginTop: 12 },
  tile: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  body: { fontFamily: font.regular, fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 1 },
  time: { fontFamily: font.regular, fontSize: 10.5, color: colors.faint, marginTop: 5 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.pink, marginTop: 4 },
});
