import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

export const APP_VERSION = packageJson.version;
