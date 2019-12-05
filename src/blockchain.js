//IMPORTS
const sha256 = require('sha256');
const currentNode = process.argv[3];
const uuid = require('uuid/v1');
const anyBase = require('any-base');
const hex2bin = anyBase(anyBase.HEX, anyBase.BIN);

//CONSTRUCTOR
function Blockchain() {
	this.allBlocks = [];
	this.mempool = [];
	this.currentNode = currentNode;
	this.nodes = [];
	this.createNewBlock(0, 0, '0', '0', [], 4);
}

//METHODS
Blockchain.prototype.createNewBlock = function(index, nonce, previousBlockHash, currentBlockHash, transactions, difficulty) {
	const newBlock = {
		index: index,
		timestamp: Date.now(),
		transactions: transactions,
		nonce: nonce,
		hash: currentBlockHash,
		difficulty: difficulty,
		previousBlockHash: previousBlockHash
	};
	if (this.allBlocks.length !== 0) {
		const lastBlock = this.getLastBlock();
		const correctHash = lastBlock.hash === newBlock.previousBlockHash;
		const correctIndex = lastBlock.index + 1 === newBlock.index;
		if (correctHash && correctIndex) {
			this.allBlocks.push(newBlock);
			this.removeMultipleTransactionsFromMempool(transactions);
			return newBlock;
		} else {
			return 0;
		}
	} else {
		this.allBlocks.push(newBlock);
		return newBlock;
	}
};

Blockchain.prototype.getLastBlock = function() {
	return this.allBlocks[this.allBlocks.length - 1];
};

Blockchain.prototype.createNewTransaction = function(amount, sender, recipient) {
	const newTransaction = {
		amount: amount,
		sender: sender,
		recipient: recipient,
		transactionId: sha256(
			uuid()
				.split('-')
				.join('')
		)
	};
	return newTransaction;
};

Blockchain.prototype.addTransactionToMempool = function(transaction) {
	this.mempool.push(transaction);
	return 1;
};

Blockchain.prototype.removeMultipleTransactionsFromMempool = function(transactionsToRemove) {
	transactionsToRemove.forEach(transactionToRemove => {
		const newMempool = this.mempool.filter(transactionFromMempool => transactionFromMempool.transactionId !== transactionToRemove.transactionId);
		this.mempool = newMempool;
	});
	return 1;
};

Blockchain.prototype.mine = function(previousBlockHash, currentBlockData, difficulty) {
	let nonce = 0;
	let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce, true);
	while (hash.substr(0, difficulty) !== '0'.repeat(difficulty)) {
		nonce++;
		hash = this.hashBlock(previousBlockHash, currentBlockData, nonce, true);
	}
	return nonce;
};

Blockchain.prototype.hashBlock = function(previousBlockHash, currentBlockData, nonce, binary) {
	const hash = sha256(previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData));
	if (binary) {
		return hex2bin('1' + hash).substr(1); //adding 1 and cuttinig it after, so the 0 at begining gets transformed to 0000
	} else {
		return hash;
	}
};

Blockchain.prototype.getDiff = function() {
	const numberOfBlockTimesToAverage = 2;
	const desiredTimeBetweenBlocks = 20 * 1000; //[ms]
	const acceptableDeviation = 10 * 1000; //[ms]

	const previousDifficulty = this.allBlocks[this.allBlocks.length - 1].difficulty;
	let currentDifficulty = previousDifficulty;

	if (this.allBlocks.length > numberOfBlockTimesToAverage) {
		const timeBetweenBlocks = this.getBlockTimestampAtT(0) - this.getBlockTimestampAtT(-numberOfBlockTimesToAverage);
		if (timeBetweenBlocks < desiredTimeBetweenBlocks - acceptableDeviation) {
			currentDifficulty++;
		} else if (timeBetweenBlocks > desiredTimeBetweenBlocks + acceptableDeviation) {
			currentDifficulty--;
		}
	}
	return currentDifficulty;
};

Blockchain.prototype.getBlockTimestampAtT = function(t) {
	return this.allBlocks[this.allBlocks.length - 1 + t].timestamp;
};

module.exports = Blockchain;
