require("dotenv").config({ path: ".env.local" });
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// firebase token validation
const admin = require("firebase-admin");
// serviceAccount = require("./smart-deals-firebase-admin-key.json");

const decoded = Buffer.from(
  process.env.FIREBASE_SERVICE_KEY,
  "base64"
).toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// mongoDB link
const uri = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());

// firebase token verification
const verifyFireBaseToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorize Access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorize Access" });
  }

  try {
    const authInfo = await admin.auth().verifyIdToken(token);
    req.token_email = authInfo.email;
    next();
  } catch {
    return res.status(401).send({ message: "Unauthorize Access" });
  }
};

app.get("/", (req, res) => {
  res.send("smart deals server running");
});

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    // api related data here
    const smartDeals = client.db("smartDeals");
    const productsCollection = smartDeals.collection("productsCollection");
    const bidsCollection = smartDeals.collection("bidsCollection");

    // get all products
    app.get("/products", async (req, res) => {
      const cursor = productsCollection.find().sort({ created_at: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    // get recent products
    app.get("/recentProducts", async (req, res) => {
      const query = parseInt(req.query.limit) || 6;
      const cursor = productsCollection
        .find()
        .sort({ created_at: -1 })
        .limit(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // get specific products
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    // create product
    app.post("/products", verifyFireBaseToken, async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });

    // get Users products
    app.get("/myProducts/:email", verifyFireBaseToken, async (req, res) => {
      const { email } = req.params;

      if (req.token_email !== email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const result = await productsCollection
        .find({ email: email })
        .sort({ created_at: -1 })
        .toArray();
      res.send(result);
    });

    // modify product by put
    app.put("/products/:id", verifyFireBaseToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedProduct = {
        $set: { ...req.body },
      };
      const result = await productsCollection.updateOne(query, updatedProduct);
      res.send(result);
    });

    // delete product from database
    app.delete("/products/:id", verifyFireBaseToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    // create bid
    app.post("/bids", verifyFireBaseToken, async (req, res) => {
      const newBid = req.body;
      const result = await bidsCollection.insertOne(newBid);
      res.send(result);
    });

    // get bid by product
    app.get(
      "/bids/product/:productId",
      verifyFireBaseToken,
      async (req, res) => {
        const { productId } = req.params;

        const result = await bidsCollection
          .find({ product_id: productId })
          .sort({ created_at: -1 })
          .toArray();
        res.send(result);
      }
    );

    // get bid by user
    app.get("/bids/user/:email", verifyFireBaseToken, async (req, res) => {
      const { email } = req.params;

      if (req.token_email !== email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const result = await bidsCollection
        .find({ buyer_email: email })
        .sort({ created_at: -1 })
        .toArray();
      res.send(result);
    });

    // delete bid
    app.delete("/bids/:id", verifyFireBaseToken, async (req, res) => {
      const { id } = req.params;
      const result = await bidsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // end of database related works
  } finally {
  }
}
run().catch(console.dir);

module.exports = app;
