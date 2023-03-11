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

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}
async function run() {
    try {
        await client.connect();
        const partCollection = client.db('techmate_technologies').collection('parts');
        const orderCollection = client.db('techmate_technologies').collection('orders');
        const paymentCollection = client.db('techmate_technologies').collection('payments');
        const reviewCollection = client.db('techmate_technologies').collection('reviews');
        const userCollection = client.db('techmate_technologies').collection('users');

        //parts apis
        //GET
        app.get('/parts', async (req, res) => {
            const query = {};
            const cursor = partCollection.find(query).sort([['_id', -1]]);
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
            res.send(result);
        });
        //PUT UPDATE ONE ITEM
        app.put('/parts/purchase/:partId', async (req, res) => {
            const id = req.params.partId;
            const updatedPart = req.body;
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
        app.get('/orders', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email: email };
                const cursor = orderCollection.find(query).sort([['_id', -1]]);
                const orders = await cursor.toArray();
                res.send(orders);
            }
            else {
                res.status(403).send({ message: 'Forbidden Access' })
            }
        });

        //DELETE ORDERS
        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
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

        //POST REVIEW
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        });
        //GET REVIEWS
        app.get('/reviews', async (req, res) => {
            const query = {};
            const cursor = reviewCollection.find(query).sort([['_id', -1]]);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });
        //POST USERS
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        //GET ONE USER
        app.get('/users', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const users = await userCollection.findOne(query);
            res.send(users);
        });
        //GET ALL USERS
        app.get('/user', verifyJWT, async (req, res) => {
            const query = {};
            const cursor = userCollection.find(query).sort([['_id', -1]]);
            const users = await cursor.toArray();
            res.send(users);
        });
        //PUT
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: user,
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        });

        // PUT ADMIN
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
        // GET ADMIN
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })


        //POST PART
        app.post('/parts', async (req, res) => {
            const part = req.body;
            const result = await partCollection.insertOne(part);
            res.send(result);
        });

        //GET
        app.get('/allorders', async (req, res) => {
            const query = {};
            const cursor = orderCollection.find(query).sort([['paid', 1]]);
            const orders = await cursor.toArray();
            res.send(orders);
        });
        //DELETE PARTS
        app.delete('/parts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await partCollection.deleteOne(query);
            res.send(result);
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