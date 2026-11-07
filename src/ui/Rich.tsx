import { Text, type StyleProp, type TextStyle } from 'react-native';

import { colors } from './colors';

/**
 * Text with highlighted parts: `{…}` is shown in the accent colour (the key numbers and phrases,
 * so skimming just the yellow gives the rule) and `[…]` in the main text colour (a lead-in).
 * The rest uses `style`, normally muted.
 */
export function Rich({ text, style, testID }: { text: string; style: StyleProp<TextStyle>; testID?: string }) {
  const parts = text.split(/(\{[^}]*\}|\[[^\]]*\])/).filter(Boolean);
  return (
    <Text testID={testID} style={style}>
      {parts.map((p, i) => {
        if (p.startsWith('{')) return <Text key={i} style={{ color: colors.accent }}>{p.slice(1, -1)}</Text>;
        if (p.startsWith('[')) return <Text key={i} style={{ color: colors.text }}>{p.slice(1, -1)}</Text>;
        return p;
      })}
    </Text>
  );
}
