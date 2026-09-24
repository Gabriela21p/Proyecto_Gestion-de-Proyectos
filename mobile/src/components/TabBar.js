import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const tabs = [
  { key: 'explore', icon: '⌖', label: 'Explorar' },
  { key: 'register', icon: '+', label: 'Registrar' },
  { key: 'profile', icon: 'R', label: 'Mi cuenta' },
];

export default function TabBar({ active, onNavigate }) {
  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const selected = active === tab.key;
        return (
          <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onNavigate(tab.key)} style={styles.tab}>
            <View style={[styles.icon, selected && styles.iconActive]}><Text style={[styles.iconText, selected && styles.iconTextActive]}>{tab.icon}</Text></View>
            <Text style={[styles.label, selected && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', minHeight: 70, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, backgroundColor: colors.white },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  icon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  iconActive: { backgroundColor: colors.green },
  iconText: { color: colors.muted, fontSize: 17, fontWeight: '900' },
  iconTextActive: { color: colors.white },
  label: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  labelActive: { color: colors.green },
});
