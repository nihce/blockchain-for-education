//IMPORTS
const express = require('express');
const app = express();
const rp = require('request-promise');
const bodyParser = require('body-parser');
const port = process.argv[2];
const cryptocurrency = require('./blockchain');
const sha256 = require('sha256');
const uuid = require('uuid/v1');
const path = require('path');
const { Worker } = require('worker_threads');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const pathToAnalyticsFile = path.resolve('data/analytics.csv');
fs.truncate(pathToAnalyticsFile, 0, function() {});
const analyticsWriter = createCsvWriter({
	path: pathToAnalyticsFile,
	header: [
		{ id: 'blockIndex', title: 'BlockIndex' },
		{ id: 'timestamp', title: 'Timestamp' },
		{ id: 'difficulty', title: 'Difficulty' },
		{ id: 'nonce', title: 'Nonce' },
		{ id: 'numberOfTransactions', title: 'NumberOfTransactions' }
	]
});
const currentNodeCryptoAddress = sha256(
	uuid()
		.split('-')
		.join('')
);
console.log('currentNodeCryptoAddress:', currentNodeCryptoAddress);
const mihicoin = new cryptocurrency(); //name your cryptocurrency

let worker = 0; //has to be global

//ENDPOINTS
//parsing from JSON to object when receiving a request
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false, parameterLimit: 100000, limit: '1gb' }));

app.get('/mihicoin', function(req, res) {
	res.send(mihicoin);
});

app.post('/broadcastTransaction', function(req, res) {
	const newTransaction = mihicoin.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
	mihicoin.addTransactionToMempool(newTransaction);
	const multiplePromises = [];
	mihicoin.nodes.forEach(node => {
		const singlePromise = {
			uri: node + '/receiveTransaction',
			method: 'POST',
			body: newTransaction,
			json: true,
			simple: false
		};
		multiplePromises.push(rp(singlePromise));
	});
	Promise.allSettled(multiplePromises) //Promise.all would break execution if one of nodes is no longer online
		.then(() => {
			res.json({ note: 'OK' });
		})
		.catch(err => {
			console.log(err);
		});
});

app.post('/receiveTransaction', function(req, res) {
	const newTransaction = req.body;
	mihicoin.addTransactionToMempool(newTransaction);
	res.json({ note: 'OK' });
});

app.get('/startMining', function(req, res) {
	const lastBlock = mihicoin.getLastBlock();
	const previousBlockHash = lastBlock['hash'];
	const difficulty = mihicoin.getDiff();
	const miningReward = {
		amount: 100,
		sender: '00',
		recipient: currentNodeCryptoAddress
	};
	const currentBlockData = {
		transactions: [...mihicoin.mempool, miningReward],
		index: lastBlock['index'] + 1
	};

	worker = new Worker(path.resolve('src/miner.js'), { workerData: { previousBlockHash: previousBlockHash, currentBlockData: currentBlockData, difficulty: difficulty } });

	worker.on('message', workerMessage => {
		worker.terminate();
		const nonce = workerMessage;
		const currentBlockHash = mihicoin.hashBlock(previousBlockHash, currentBlockData, nonce, false);
		const newBlock = mihicoin.createNewBlock(currentBlockData.index, nonce, previousBlockHash, currentBlockHash, currentBlockData.transactions, difficulty);
		//check if block is relevant and correct
		const correctHash = lastBlock.hash === newBlock.previousBlockHash;
		const correctIndex = lastBlock['index'] + 1 === newBlock['index'];
		if (newBlock !== 0 && correctHash && correctIndex) {
			// console.log('Mined new block No.:', newBlock['index']);
			analyticsWriter.writeRecords([
				{
					blockIndex: newBlock.index,
					timestamp: newBlock.timestamp,
					difficulty: newBlock.difficulty,
					nonce: newBlock.nonce,
					numberOfTransactions: newBlock.transactions.length
				}
			]);
			const multiplePromises = [];
			mihicoin.nodes.forEach(node => {
				const singlePromise = {
					uri: node + '/receiveBlock',
					method: 'POST',
					body: { newBlock: newBlock },
					json: true,
					simple: false
				};
				multiplePromises.push(rp(singlePromise));
			});
			Promise.allSettled(multiplePromises).catch(err => {
				console.log(err);
			});
		}
		startNewMiningCycleAfter(1000 + getRandomInt(2000));
	});
	res.json({ note: 'Mining process started...' });
});

app.post('/receiveBlock', function(req, res) {
	const newBlock = req.body.newBlock;
	const lastBlock = mihicoin.getLastBlock();
	const correctHash = lastBlock.hash === newBlock.previousBlockHash;
	const correctIndex = lastBlock['index'] + 1 === newBlock['index'];
	// console.log('Received new block No.:', newBlock['index']);
	if (correctHash && correctIndex) {
		if (worker !== 0) {
			worker.terminate(); //stop mining because received block is correct
		}
		analyticsWriter.writeRecords([
			{
				blockIndex: newBlock.index,
				timestamp: newBlock.timestamp,
				difficulty: newBlock.difficulty,
				nonce: newBlock.nonce,
				numberOfTransactions: newBlock.transactions.length
			}
		]);
		mihicoin.allBlocks.push(newBlock);
		mihicoin.removeMultipleTransactionsFromMempool(newBlock.transactions);
		startNewMiningCycleAfter(1000 + getRandomInt(2000));
		res.json({ note: 'OK' });
	} else {
		res.json({ note: 'ERROR' });
	}
});

app.post('/broadcastNewNode', function(req, res) {
	const newNode = req.body.newNode;
	if (mihicoin.nodes.indexOf(newNode) == -1) {
		mihicoin.nodes.push(newNode);
	}
	const multiplePromises = [];
	mihicoin.nodes.forEach(node => {
		const singlePromise = {
			uri: node + '/receiveNewNode',
			method: 'POST',
			body: { newNode: newNode },
			json: true,
			simple: false
		};
		multiplePromises.push(rp(singlePromise));
	});
	Promise.allSettled(multiplePromises) //Promise.all would break execution if one of nodes is no longer online
		.then(() => {
			const allKnownNodes = {
				uri: newNode + '/receiveAllNodes',
				method: 'POST',
				body: {
					allNetworkNodes: [...mihicoin.nodes, mihicoin.currentNode],
					allBlocks: mihicoin.allBlocks,
					mempool: mihicoin.mempool
				},
				json: true,
				simple: false
			};
			return rp(allKnownNodes);
		})
		.catch(err => {
			console.log(err);
		})
		.then(() => {
			res.json({ note: 'OK' });
		})
		.catch(err => {
			console.log(err);
		});
});

app.post('/receiveNewNode', function(req, res) {
	const newNode = req.body.newNode;
	if (mihicoin.nodes.indexOf(newNode) == -1 && mihicoin.currentNode !== newNode) {
		mihicoin.nodes.push(newNode);
		res.json({ note: 'OK' });
	} else {
		res.json({ note: 'ERROR' });
	}
});

app.post('/receiveAllNodes', function(req, res) {
	mihicoin.allBlocks = req.body.allBlocks;
	mihicoin.mempool = req.body.mempool;
	const allNetworkNodes = req.body.allNetworkNodes;
	allNetworkNodes.forEach(newNode => {
		if (mihicoin.nodes.indexOf(newNode) == -1 && mihicoin.currentNode !== newNode) {
			mihicoin.nodes.push(newNode);
		}
	});
	res.json({ note: 'OK' });
});

app.listen(port, function() {
	console.log(`This node is running on: localhost/${port}`);
});

//FUNCTIONS
async function startNewMiningCycleAfter(milliseconds) {
	await sleep(milliseconds);
	const singlePromise = {
		uri: mihicoin.currentNode + '/startMining',
		method: 'GET',
		json: true
	};
	return rp(singlePromise);
}

function sleep(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

function getRandomInt(max) {
	return Math.floor(Math.random() * Math.floor(max));
}
