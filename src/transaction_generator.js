//IMPORTS
const rp = require('request-promise');
const sha256 = require('sha256');
const uuid = require('uuid/v1');
const random = require('random');

const minTimeout = 500;
const maxTimeout = 5000;

generator();

function generator() {
	const newTransaction = createRandomTransaction();
	const singlePromise = {
		uri: 'http://localhost:5001/broadcastTransaction',
		method: 'POST',
		body: newTransaction,
		json: true
	};
	rp(singlePromise)
		.then(function(body) {
			console.log(body);
			console.log();
			setTimeout(generator, random.int(minTimeout, maxTimeout));
		})
		.catch(err => {
			console.log(err);
		});
}

function createRandomTransaction() {
	var transaction = new Object();
	transaction.amount = random.int(0, 100);
	transaction.sender = sha256(
		uuid()
			.split('-')
			.join('')
	);
	transaction.recipient = sha256(
		uuid()
			.split('-')
			.join('')
	);
	console.log(JSON.stringify(transaction));
	return transaction;
}
