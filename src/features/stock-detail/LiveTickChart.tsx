import { memo } from 'react';
import type { Theme } from '../../theme/theme';
import { useTickHistory } from './useTickHistory';
import { InteractiveTickChart } from './InteractiveTickChart';

type Props = {
  symbol: string;
  available: boolean;
  theme: Theme;
  onInteractionChange: (active: boolean) => void;
};

export const LiveTickChart = memo(function LiveTickChart({ symbol, ...props }: Props) {
  const points = useTickHistory(symbol);
  return <InteractiveTickChart points={points} {...props} />;
});
