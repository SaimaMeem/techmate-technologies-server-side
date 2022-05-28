const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
        const orderCollection = client.db('techmate_technologies').collection('orders');
        const paymentCollection = client.db('techmate_technologies').collection('payments');

        //parts apis
        //GET
        app.get('/parts', async (req, res) => {
            const query = {};
            const cursor = partCollection.find(query);
            const parts = await cursor.toArray();
            res.send(parts);
        });

        //GET ONE ITEM
        app.get('/parts/purchase/:partId', async (req, res) => {
            const id = req.params.partId;
            const query = { _id: ObjectId(id) };
            const part = await partCollection.findOne(query);
            res.send(part);
        });
        //POST ADD ONE ORDER
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            console.log(result);
            res.send(result);
        });
        //PUT UPDATE ONE ITEM
        app.put('/parts/purchase/:partId', async (req, res) => {
            const id = req.params.partId;
            const updatedPart = req.body;
            console.log(updatedPart);
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    available_quantity: updatedPart.available_quantity,
                }
            }
            const result = await partCollection.updateOne(filter, updatedDoc, options);

            res.send(result);
        })

        //GET ORDERS
        app.get('/orders', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const cursor = orderCollection.find(query);
            const orders = await cursor.toArray();
            res.send(orders);
        });

        //DELETE ORDERS
        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });
        //GET ONE ORDER
        app.get('/orders/:orderId', async (req, res) => {
            const id = req.params.orderId;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.findOne(query);
            res.send(order);
        });
        //POST PAYMENT
        app.post('/create-payment-intent', async (req, res) => {
            const order = req.body;
            const price = order?.total_price;
            console.log(price);
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            });
        })
        //PATCH ORDER
        app.patch('/orders/:orderId', async (req, res) => {
            const id = req.params.orderId;
            const payment = req.body;
            console.log('patch', payment);
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
            // sendPaymentConfirmationEmail(payment);
            res.send({ success: true, updatedOrder });
            // res.send(updatedOrder);

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