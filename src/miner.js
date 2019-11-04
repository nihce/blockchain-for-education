const cryptocurrency = require('./blockchain');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const mihicoin = new cryptocurrency();
const nonce = mihicoin.mine(workerData.previousBlockHash, workerData.currentBlockData);
parentPort.postMessage(nonce);
