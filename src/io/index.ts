export { WebFileIO } from './web/webFileIO';
export type { FileIO, ProjectHandle, ProjectRef } from './types';

import { isElectron } from '../platform/env';
import type { FileIO } from './types';
import { WebFileIO } from './web/webFileIO';
import { ElectronFileIO } from './electron/electronFileIO';

export const fileIO: FileIO = isElectron() ? new ElectronFileIO() : new WebFileIO();
