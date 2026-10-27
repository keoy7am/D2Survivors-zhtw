// 新版偵測的版本比對
import assert from 'node:assert/strict';
import { isNewer } from '../extension/update.js';

assert.equal(isNewer('1.2.1', '1.2.0'), true);
assert.equal(isNewer('v1.10.0', '1.9.2'), true);
assert.equal(isNewer('2.0', '1.99.99'), true);
assert.equal(isNewer('1.2.0', '1.2.0'), false);
assert.equal(isNewer('1.1.9', '1.2.0'), false);
assert.equal(isNewer('1.2', '1.2.0'), false);
assert.equal(isNewer(undefined, '1.2.0'), false);
console.log('update ok');
