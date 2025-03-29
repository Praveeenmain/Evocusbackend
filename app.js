require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const { ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const cors = require('cors');
const { connectToDb, getDb } = require('./db');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const api=process.env.AI_url
const genAI = new GoogleGenerativeAI(api); 
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
    app.listen(3002, () => {
      console.log('App is listening on port 3002');
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


app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: "Please provide a message" });
    }

    // Ensure database connection
    if (!db) {
      return res.status(500).json({ message: "Database connection not established" });
    }

    // Check if `products` and `services` collections exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);

    if (!collectionNames.includes("products") && !collectionNames.includes("services")) {
      return res.status(200).json({ response: "No relevant products or services found in the database." });
    }

    let context = "You are an Evobuz AI,ask me about services and products. Respond strictly based on the following database information.\n\n";

    // Fetch `products` collection with all details
    if (collectionNames.includes("products")) {
      const products = await db.collection("products").find().limit(5).toArray();
      if (products.length > 0) {
        context += "Products:\n";
        products.forEach((p) => {
          context += `- Name: ${p.productName}\n`;
          context += `  Category: ${p.productCategory}\n`;
          if (p.price) context += `  Price: ${p.price}\n`;
          if (p.description) context += `  Description: ${p.description}\n`;
          if (p.brand) context += `  Brand: ${p.brand}\n`;
          context += "\n";
        });
      }
    }

    // Fetch `services` collection with all details
    if (collectionNames.includes("services")) {
      const services = await db.collection("services").find().toArray();
      if (services.length > 0) {
        context += "Services:\n";
        services.forEach((s) => {
          context += `- Name: ${s.serviceName}\n`;
          context += `  Category: ${s.serviceCategory}\n`;
          if (s.location) context += `  Location: ${s.location}\n`;
          if (s.description_ser) context += `  Description: ${s.description_ser}\n`;
          if (s.lowestAmount && s.highestAmount) {
            context += `  Price Range: ₹${s.lowestAmount} - ₹${s.highestAmount}\n`;
          }
          context += "\n";
        });
      }
    }

    // If no relevant data was found
    if (context === "You are an AI assistant. Respond strictly based on the following database information.\n\n") {
      return res.status(200).json({ response: "No relevant information found in the database." });
    }

    // Generate AI response using Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: `${context}\nUser Query: ${message}` }]
        }
      ]
    });

    // Ensure correct extraction of response text
    const responseText = result.response.text();

    return res.status(200).json({ response: responseText });

  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});












