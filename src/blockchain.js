//IMPORTS
const sha256 = require('sha256');
const currentNode = process.argv[3];
const uuid = require('uuid/v1');

//CONSTRUCTOR
function Blockchain () {
    this.allBlocks = [];
    this.mempool = [];
    this.currentNode = currentNode;
    this.nodes = [];
    this.createNewBlock(0, '0', '0');
};

//METHODS
Blockchain.prototype.createNewBlock = function (nonce, previousBlockHash, hash) {
    const newBlock = {
        index: this.allBlocks.length + 1,
        timestamp: Date.now(),
        transactions: this.mempool,
        nonce: nonce,
        hash: hash,
        previousBlockHash: previousBlockHash
    };
    this.mempool = [];
    this.allBlocks.push(newBlock);
    return newBlock;
};

Blockchain.prototype.getLastBlock = function () {
    return this.allBlocks[this.allBlocks.length-1]; //-1, ker je prvi blok this.allBlocks[0]
};

Blockchain.prototype.createNewTransaction = function (amount, sender, recipient) {
    const newTransaction = {
        amount: amount,
        sender: sender,
        recipient: recipient,
        transactionId: sha256(uuid().split('-').join(''))
    };
    return newTransaction;
};

Blockchain.prototype.addTransactionToMempool = function (transaction) {
    this.mempool.push(transaction);
    return 1;
};

Blockchain.prototype.mine = function (previousBlockHash, currentBlockData) {
    let nonce = 0;
    let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    while (hash.substr(0, 4) !== '0000') {
        nonce++;
        hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    };
    return nonce;
};

Blockchain.prototype.hashBlock = function (previousBlockHash, currentBlockData, nonce) {
    const hash = sha256(previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData));
    return hash;
};

module.exports = Blockchain;
