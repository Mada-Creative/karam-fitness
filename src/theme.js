import { Platform } from 'react-native';

export const colors = {
  bg: '#0e0f12',
  body: '#1b1e24',
  bodyEdge: '#262a32',
  lcd: '#cfd8cb',
  lcdInk: '#1c2320',
  lcdDim: '#5c6a61',
  lcdLine: '#b5c1b0',
  lcdActive: 'rgba(28, 35, 32, 0.12)',
  bezel: '#0b0c0f',
  keyFn: '#2f343e',
  keySys: '#3a404c',
  keyNum: '#eeece7',
  keyNumInk: '#1d2026',
  keyOp: '#cdd1d8',
  keyWarn: '#e0643f',
  keyEq: '#3a86ff',
  ink: '#eef0f3',
  shift: '#f4a93b',
  shiftInk: '#2a1a00',
  alpha: '#3fd0c4',
  alphaInk: '#002b27',
  sheet: '#20242b',
  sheetItem: '#2a2f38',
  muted: '#8b93a1',
};

export const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
