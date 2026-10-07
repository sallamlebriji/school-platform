import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
export const colors = { navy: '#1D3462', gold: '#B08D57', paper: '#F7F4EE', muted: '#6C7482', line: '#E7E2D9' };
export function Card({ children }: PropsWithChildren) { return <View style={s.card}>{children}</View>; }
export function Title({ children }: PropsWithChildren) { return <Text style={s.title}>{children}</Text>; }
export function Muted({ children }: PropsWithChildren) { return <Text style={s.muted}>{children}</Text>; }
export function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, disabled && { opacity: .5 }]}><Text style={s.buttonText}>{label}</Text></Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) { return <View style={{ gap: 7 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={s.input} {...props} /></View>; }
export const s = StyleSheet.create({
  card: { backgroundColor: 'white', borderRadius: 18, padding: 20, gap: 10, borderWidth: 1, borderColor: colors.line },
  title: { color: colors.navy, fontSize: 21, fontWeight: '700' },
  muted: { color: colors.muted, lineHeight: 21, fontSize: 14 },
  label: { color: colors.navy, fontWeight: '600' },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, color: colors.navy, fontSize: 16 },
  button: { backgroundColor: colors.navy, padding: 15, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 15 },
});
