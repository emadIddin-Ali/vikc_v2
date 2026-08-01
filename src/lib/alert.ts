import { Alert as RNAlert, Platform } from 'react-native';

type AlertButton = {
  text?: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
};

/**
 * `Alert.alert` som fungerar även i webbläsaren.
 *
 * react-native-web har en Alert-modul, men dess `alert()` är bokstavligen en tom
 * funktion: `static alert() {}`. Ingen ruta visas, ingen knapp trycks — och
 * eftersom hela åtgärden ligger i knappens `onPress` blev varje bekräftelse en
 * död knapp på webben. "Ta bort aktivitet", "Byt kod", "Arkivera klass" gjorde
 * ingenting, och felmeddelanden vid incheckning försvann tyst.
 *
 * Här används webbläsarens egna dialoger i stället, med samma API som RN:s, så
 * anropsställena ser likadana ut på alla plattformar. Knapptexterna blir
 * webbläsarens ("OK"/"Avbryt") — frågan i meddelandet får bära innebörden.
 */
function webAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const text = message ? `${title}\n\n${message}` : title;
  const action = buttons?.find((b) => b.style !== 'cancel');

  // Ett ensamt (eller inget) knappalternativ är ett besked, inte en fråga.
  if (!buttons || buttons.length < 2) {
    window.alert(text);
    void action?.onPress?.();
    return;
  }

  const chosen = window.confirm(text) ? action : buttons.find((b) => b.style === 'cancel');
  void chosen?.onPress?.();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS === 'web') return webAlert(title, message, buttons);
    RNAlert.alert(title, message, buttons);
  },
};
