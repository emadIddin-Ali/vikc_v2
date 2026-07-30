import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { colors, font } from '@/theme/tokens';

/**
 * Integritetspolicy (GDPR art. 12–14), skriven i klarspråk eftersom appen
 * riktar sig till barn/ungdomar.
 *
 * OBS innan lansering: fyll i platshållarna [ ... ] med personuppgiftsansvarig
 * (förening/kommun/appleverantör), kontakt-e-post och Supabase-region. Se
 * README för den juridiska checklistan (DPA, registerförteckning, ev. DPIA).
 */
export default function Privacy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Icon name="arrowL" size={18} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Integritetspolicy</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Senast uppdaterad: [DATUM]</Text>

        <Text style={styles.p}>
          LEVLA är en app för föreningar där du kan checka in på aktiviteter, tjäna poäng och lösa in
          belöningar. Här förklarar vi vilka uppgifter vi sparar om dig, varför, och vilka rättigheter du har.
          Vi har skrivit det så enkelt vi kan.
        </Text>

        <Section title="Vem ansvarar för dina uppgifter?">
          <Text style={styles.p}>
            Personuppgiftsansvarig är [FÖRENINGENS/HUVUDMANNENS NAMN]. Har du frågor eller vill använda dina
            rättigheter når du oss på [KONTAKT-E-POST].
          </Text>
        </Section>

        <Section title="Vad vi sparar">
          <Bullet>Ditt namn och din e-postadress (eller ditt Google-konto om du loggar in med Google).</Bullet>
          <Bullet>Din förening, din roll och dina poäng, nivå, svit och antal besök.</Bullet>
          <Bullet>Dina incheckningar (vilken aktivitet och när).</Bullet>
          <Bullet>Foton – bara om en aktivitet uttryckligen kräver ett fotobevis, och bara det du själv tar.</Bullet>
          <Bullet>Om du är förälder: namn (och valfritt födelseår) på de barn du lägger till.</Bullet>
          <Bullet>En teknisk kod för pushnotiser, om du sagt ja till notiser.</Bullet>
        </Section>

        <Section title="Din plats">
          <Text style={styles.p}>
            När du checkar in kontrollerar appen att du är på rätt plats. Vi använder din position bara i det
            ögonblicket för att jämföra avståndet till aktiviteten – <Text style={styles.b}>vi sparar aldrig dina
            koordinater</Text>.
          </Text>
        </Section>

        <Section title="Varför vi sparar det">
          <Text style={styles.p}>
            För att appen ska fungera: visa dina poäng och märken, låta ledare se närvaro, och ge föreningen
            statistik. Vi säljer aldrig dina uppgifter och använder dem inte för reklam.
          </Text>
        </Section>

        <Section title="Ålder och samtycke">
          <Text style={styles.p}>
            Är du under 13 år ska en vårdnadshavare godkänna att du använder appen, eller så lägger en förälder
            till dig via sitt eget konto. När du skapar konto bekräftar du att du är minst 13 år eller har
            målsmans godkännande.
          </Text>
        </Section>

        <Section title="Var uppgifterna lagras">
          <Text style={styles.p}>
            Uppgifterna lagras hos vår databasleverantör Supabase inom EU ([REGION, t.ex. Frankfurt]). Pushnotiser
            skickas via Expo och Google-inloggning sker via Google – dessa kan innebära överföring till USA under
            gällande skyddsregler.
          </Text>
        </Section>

        <Section title="Hur länge">
          <Text style={styles.p}>
            Vi sparar dina uppgifter så länge du har ett konto. Raderar du kontot tas dina uppgifter bort. Ledare
            och förening kan se närvarohistorik under [ANGE LAGRINGSTID, t.ex. innevarande + föregående termin].
          </Text>
        </Section>

        <Section title="Dina rättigheter">
          <Bullet>Se vilka uppgifter vi har om dig.</Bullet>
          <Bullet>Rätta uppgifter som är fel.</Bullet>
          <Bullet>Radera ditt konto direkt i appen (Profil → Radera konto).</Bullet>
          <Bullet>Få ut dina uppgifter eller återkalla ditt samtycke.</Bullet>
          <Bullet>Klaga till Integritetsskyddsmyndigheten (IMY) om du tycker att vi gör fel.</Bullet>
        </Section>

        <Text style={[styles.p, { marginTop: 18, color: colors.muted2 }]}>
          Frågor? Kontakta oss på [KONTAKT-E-POST].
        </Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={styles.h2}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={[styles.p, { flex: 1, marginTop: 0 }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efe9ff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, paddingHorizontal: 20 },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: font.bold, fontSize: 18, color: colors.ink },
  updated: { fontFamily: font.regular, fontSize: 11.5, color: colors.faint, marginTop: 8 },
  h2: { fontFamily: font.bold, fontSize: 15, color: colors.ink, marginBottom: 6 },
  p: { fontFamily: font.regular, fontSize: 13.5, color: colors.ink, lineHeight: 20, marginTop: 6 },
  b: { fontFamily: font.semibold, color: colors.ink },
  bulletRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  bulletDot: { fontFamily: font.bold, fontSize: 14, color: colors.primary, lineHeight: 20 },
});
