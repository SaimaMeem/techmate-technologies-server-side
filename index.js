const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();


//middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nba7e.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const partCollection = client.db('techmate_technologies').collection('parts');

        //parts apis
        app.get('/parts', async (req, res) => {
            const query = {};
            const cursor = partCollection.find(query);
            const parts = await cursor.toArray();
            res.send(parts);
        });

    }
    finally {

    }

}
run().catch(console.dir);
//basic
app.get('/', async (req, res) => {
    res.send('Running Techmate Technlogies Server!');
});

app.listen(port, () => {
    console.log('running on the port', port);
})