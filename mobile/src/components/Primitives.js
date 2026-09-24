import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, shadow } from '../theme';

export function BrandHeader({ eyebrow = 'BOGOTÁ, COLOMBIA', title, subtitle, right }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.mark}><Text style={styles.markText}>R</Text></View>
        <View><Text style={styles.brand}>Rolling</Text><Text style={styles.eyebrow}>{eyebrow}</Text></View>
        {right ? <View style={styles.headerRight}>{right}</View> : null}
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Field({ label, multiline, style, ...props }) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor="#89938e" style={[styles.field, multiline && styles.multiline, style]} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} {...props} />
    </View>
  );
}

export function Button({ children, kind = 'primary', loading, disabled, style, textStyle, ...props }) {
  const inactive = disabled || loading;
  return (
    <Pressable disabled={inactive} style={({ pressed }) => [styles.button, styles[`button_${kind}`], inactive && styles.disabled, pressed && styles.pressed, style]} {...props}>
      {loading ? <ActivityIndicator color={kind === 'primary' ? colors.white : colors.green} /> : <Text style={[styles.buttonText, styles[`buttonText_${kind}`], textStyle]}>{children}</Text>}
    </Pressable>
  );
}

export function Notice({ children, error = false }) {
  if (!children) return null;
  return <View style={[styles.notice, error && styles.noticeError]}><Text style={[styles.noticeText, error && styles.noticeErrorText]}>{children}</Text></View>;
}

export function Pill({ children, active, onPress }) {
  const content = <Text style={[styles.pillText, active && styles.pillTextActive]}>{children}</Text>;
  if (!onPress) return <View style={[styles.pill, active && styles.pillActive]}>{content}</View>;
  return <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  mark: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: colors.lime },
  markText: { fontFamily: 'serif', color: colors.ink, fontSize: 20, fontWeight: '900' },
  brand: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  eyebrow: { color: colors.coral, fontSize: 9, fontWeight: '900', letterSpacing: 1.25 },
  headerRight: { marginLeft: 'auto' },
  title: { maxWidth: 340, marginTop: 20, color: colors.ink, fontFamily: 'serif', fontSize: 38, fontWeight: '700', lineHeight: 39, letterSpacing: -1.2 },
  subtitle: { maxWidth: 355, marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 21 },
  fieldWrap: { gap: 7 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  field: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 14, color: colors.ink, backgroundColor: colors.white, fontSize: 15 },
  multiline: { minHeight: 120, paddingTop: 14 },
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  button_primary: { backgroundColor: colors.green, ...shadow },
  button_secondary: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  button_ghost: { backgroundColor: 'transparent' },
  button_danger: { backgroundColor: '#f9e8e3' },
  buttonText: { fontSize: 13, fontWeight: '900' },
  buttonText_primary: { color: colors.white },
  buttonText_secondary: { color: colors.ink },
  buttonText_ghost: { color: colors.green },
  buttonText_danger: { color: colors.error },
  disabled: { opacity: 0.42 },
  pressed: { transform: [{ scale: 0.985 }] },
  notice: { borderLeftWidth: 3, borderLeftColor: colors.green, borderRadius: 8, padding: 11, backgroundColor: '#edf5f0' },
  noticeError: { borderLeftColor: colors.coral, backgroundColor: '#fff0eb' },
  noticeText: { color: colors.green, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  noticeErrorText: { color: colors.error },
  pill: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: colors.white },
  pillActive: { borderColor: colors.green, backgroundColor: colors.green },
  pillText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  pillTextActive: { color: colors.white },
});
