require("dotenv").config();
const express = require("express");
const initWebRoute = require("./routes/web");
const bodyParser = require("body-parser");
const cors = require("cors");

let app = express();

app.use(bodyParser.json());
app.use(cors({
    'allowedHeaders': ['sessionId', 'Content-Type'],
    'exposedHeaders': ['sessionId'],
    'origin': '*',
    'methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
    'preflightContinue': false
 }));

app.use(bodyParser.urlencoded({ extended: true }));

initWebRoute(app);

let port = process.env.PORT || 8080;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
 });
