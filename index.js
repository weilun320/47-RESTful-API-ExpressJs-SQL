let express = require("express");
let path = require("path");
const cors = require("cors");
const { Pool } = require('pg');
require('dotenv').config();
const { DATABASE_URL } = process.env;

let app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    require: true,
  },
});

async function getPostgresVersion() {
  const client = await pool.connect();
  try {
    const response = await client.query('SELECT version()');
    console.log(response.rows[0]);
  } finally {
    client.release();
  }
}

getPostgresVersion();

// Create new post
app.post("/posts", async (req, res) => {
  const client = await pool.connect();

  try {
    const data = {
      title: req.body.title,
      content: req.body.content,
      author: req.body.author,
      created_at: new Date().toISOString()
    };

    const query = "INSERT INTO posts (title, content, author, created_at) VALUES ($1, $2, $3, $4) RETURNING id";
    const params = [data.title, data.content, data.author, data.created_at];

    const result = await client.query(query, params);
    data.id = result.rows[0].id; // Assign the last inserted id to data object

    console.log(`Post created successfully with id ${data.id}`);
    res.json({ "status": "success", "data": data, "message": "Post created successfully" });
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ "error": error.message });
  } finally {
    client.release();
  }
});

// Get post by id
app.get("/posts/:id", async (req, res) => {
  const id = req.params.id;
  const client = await pool.connect();

  try {
    const query = "SELECT * FROM posts WHERE id = $1";
    const result = await client.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ "error": "Post not found" });
    }

    res.json({ "status": "success", "data": result.rows[0], "message": "Post found" });
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ "error": error.message });
  } finally {
    client.release();
  }
});

// List all posts by author name
app.get("/posts/author/:authorName", async (req, res) => {
  const author = req.params.authorName;
  const client = await pool.connect();

  try {
    const query = "SELECT * FROM posts WHERE author = $1";
    const result = await client.query(query, [author]);

    if (result.rows.length === 0) {
      return res.status(404).json({ "error": "Author not found" });
    }

    res.json(result.rows);
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ "error": error.message });
  } finally {
    client.release();
  }
});

// Retrieve all posts within a certain date range
app.get("/posts/dates/:startDate/:endDate", async (req, res) => {
  // Create date object for start date and convert to ISO string
  const startDate = new Date(req.params.startDate).toISOString();
  // Create date object for end date
  const endDate = new Date(req.params.endDate);
  // Add one day to end date
  endDate.setDate(endDate.getDate() + 1);
  // Convert end date to ISO string
  const endDateString = endDate.toISOString();
  const client = await pool.connect();

  try {
    // SQL query to retrieve all posts within start and end date inclusive
    const query = "SELECT * FROM posts WHERE created_at BETWEEN $1 AND $2";
    const params = [startDate, endDateString];
    const result = await client.query(query, params);

    if (result.rows.length === 0) {
      return res.json({ "message": "No posts found" });
    }

    res.json(result.rows);
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ "error": error.message });
  } finally {
    client.release();
  }
});

// List all posts
app.get("/posts", async (req, res) => {
  // Database client
  const client = await pool.connect();

  try {
    // SQL query to get all posts
    const query = "SELECT * FROM posts";
    // Running the query
    const result = await client.query(query);
    // Send the result to client
    res.json(result.rows);
  } catch (error) {
    console.log(error.stack);
    res.status(500).send("An error occurred");
  } finally {
    // Release the client connection
    client.release();
  }
});

// Update a specific post
app.put("/posts/:id", async (req, res) => {
  const id = req.params.id;
  const updatedData = req.body;
  const client = await pool.connect();

  try {
    const updateQuery = "UPDATE posts SET title = $1, content = $2, author = $3 WHERE id = $4 RETURNING *";
    const queryData = [updatedData.title, updatedData.content, updatedData.author, id];
    const result = await client.query(updateQuery, queryData);

    if (result.rows.length === 0) {
      return res.status(404).json({ "error": "Post not found" });
    }

    res.json({ "status": "success", "message": "Post updated successfully" });
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ "error": error.message });
  } finally {
    client.release();
  }
});

// Delete a specific post
app.delete("/posts/:id", async (req, res) => {
  const id = req.params.id;
  const client = await pool.connect();

  try {
    const deleteQuery = "DELETE FROM posts WHERE id = $1 RETURNING *";
    const result = await client.query(deleteQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ "error": "Post not found" });
    }

    res.json({ "status": "success", "message": "Post deleted successfully" });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ "error": error.message });
  } finally {
    client.release();
  }
});

// Delete all posts by author name
app.delete("/posts/author/:authorName", async (req, res) => {
  const author = req.params.authorName;
  const client = await pool.connect();

  try {
    const deleteQuery = "DELETE FROM posts WHERE author = $1 RETURNING *";
    const result = await client.query(deleteQuery, [author]);

    if (result.rows.length === 0) {
      return res.status(404).json({ "error": "Author not found" });
    }

    res.json({ "status": "success", "message": "Posts deleted successfully" });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ "error": error.message });
  } finally {
    client.release();
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/index.html"));
});

// Catch 404 and forward to error handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname + "/404.html"));
});

app.listen(3000, () => {
  console.log("App is listening on port 3000");
});

// Export the Express API
module.exports = app;