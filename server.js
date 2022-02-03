require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

let app = express();

app.use(bodyParser.json());

initWebRoute(app);

let port = process.env.PORT || 8080;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
 });
