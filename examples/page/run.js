const express = require('express')
const app = express()
const port = 3000;
const path = require('path')

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, '/index.html'));
});

app.use(express.static(path.join('..', '..', 'dist')));

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
});