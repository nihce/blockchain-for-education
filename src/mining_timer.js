//IMPORTS
const express = require('express');
const app = express();
const rp = require('request-promise');
const bodyParser = require('body-parser');
const port = process.argv[2];

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false}));

const numberOfBlocksToMine = 5;

app.get('/timer', function (req, res) {
    for (var i = 0; i < numberOfBlocksToMine; i++) {
        const singlePromise = {
            uri: 'http://localhost:5001/mineNewBlock',
            method: 'GET',
            json: true
        };
        rp(singlePromise)
        .then(function (body) {
            console.log(body);
        }).catch((err) => {console.log(err)});
    };
    res.json({note: 'Timing process started. Check console for data.'});
});

app.listen(port, function() {
    console.log(`Mining timer is running on: localhost/${port}`);
});
