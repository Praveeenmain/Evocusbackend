require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const { ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const cors = require('cors');
const { connectToDb, getDb } = require('./db');

const app = express();
app.use(bodyParser.json());
app.use(cors()); // Enable CORS

let db;

// Connect to the database and start the server
connectToDb((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    process.exit(1); // Exit the process if the connection fails
  } else {
    db = getDb();
    app.listen(3001, () => {
      console.log('App is listening on port 3001');
    });
  }
});


app.get("/products", async (req, res) => {
  try {
    // Extract query parameters from the request
    const { sort_by, category, title_search} = req.query;

    // Build a query object for MongoDB
    const query = {};

    // Add filters to the query object based on the query parameters
    if (category) {
      query.productCategory = category;
    }
    if (title_search) {
      query.productName = new RegExp(title_search, 'i'); // case-insensitive search
    }
    

    // Build sorting options
    const sort = {};
    if (sort_by) {
      sort[sort_by] = 1; // assuming ascending order, use -1 for descending
    }

    // Fetch products from the database based on the query and sort options
    const products = await db.collection('products').find(query).sort(sort).toArray();

    // Send the filtered and sorted products as the response
    res.status(200).json(products);
  } catch (error) {
    console.error("Error retrieving products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.get("/services", async (req, res) => {
  try {
    // Extract query parameters from the request
    const { sort_by, category, location_search, service_search } = req.query;

    // Build a query object for MongoDB
    const query = {};

    // Add filters to the query object based on the query parameters
    if (category) {
      query.serviceCategory = category;
    }
    if (location_search) {
      query.location = new RegExp(location_search, 'i'); // case-insensitive search
    }
    if (service_search) {
      query.serviceName = new RegExp(service_search, 'i'); // case-insensitive search
    }

    // Build sorting options
    const sort = {};
    if (sort_by) {
      sort[sort_by] = 1; // assuming ascending order, use -1 for descending
    }

    // Fetch services from the database based on the query and sort options
    const services = await db.collection('services').find(query).sort(sort).toArray();

    // Send the filtered and sorted services as the response
    res.status(200).json(services);
  } catch (error) {
    console.error("Error retrieving services:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.get("/services/:id", async (req, res) => {
  try {
    const serviceId = req.params.id; // Get the service ID from the URL parameters

    // Ensure the ID is a valid ObjectId
    if (!ObjectId.isValid(serviceId)) {
      return res.status(400).json({ message: "Invalid service ID" });
    }

    // Find the service in the database by its ID
    const service = await db.collection('services').findOne({ _id: new ObjectId(serviceId) });

    // If the service doesn't exist, return a 404 error
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    // Send the service as the response
    res.status(200).json(service);
  } catch (error) {
    console.error("Error retrieving service:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.get("/products/:id", async(req , res) => {
  try{
    const productId = req.params.id;
   
    if (!ObjectId.isValid(productId)){
      return res.status(404).json({ message: "Invalid product id"});
    }

    const product = await db.collection('products').findOne({_id: new ObjectId(productId) });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    
    res.status(200).json(product);
  } catch (error) {
    console.error("Error retrieving product:", error);
    res.status(500).json({ message: "Internal server error" });
  }
  }
);



