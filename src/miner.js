const cryptocurrency = require('./blockchain');
const { parentPort, workerData } = require('worker_threads');

const mihicoin = new cryptocurrency();
const nonce = mihicoin.mine(workerData.previousBlockHash, workerData.currentBlockData, workerData.difficulty);
parentPort.postMessage(nonce);
