import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParams = { Portfolio: undefined; Watchlist: undefined };
export type RootStackParams = {
  Home: NavigatorScreenParams<MainTabParams> | undefined;
  StockDetail: { symbol: string };
};
