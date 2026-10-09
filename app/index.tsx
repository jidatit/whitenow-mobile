import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme/tokens';

// Foundation placeholder. Authentication and role routing replace this in the next checkpoint.
export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Whitenow</Text>
      <Text style={styles.body}>Foundation build</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  title: { ...typography.title, color: colors.secondary },
  body: { ...typography.body, color: colors.textMuted },
});
