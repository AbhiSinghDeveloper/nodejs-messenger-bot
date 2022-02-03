const express = require("express");


let router = express.Router();

let initWebRoutes = async (app) => {
    
    router.get("/webhook", chatBotController.getWebhook);
    router.post("/webhook", chatBotController.postWebhook);

    return app.use("/", router);
};
