export { WebFileIO } from './web/webFileIO';
export type { FileIO, ProjectHandle } from './types';

import { WebFileIO } from './web/webFileIO';

// Environment detection — swap for ElectronFileIO when in Electron
export const fileIO = new WebFileIO();
