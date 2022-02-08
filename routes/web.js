const express = require("express");
const chatBotController = require("../controllers/chatBotController");
const messagesController = require("../controllers/messagesController");

let router = express.Router();

let initWebRoutes = async (app) => {
    router.get("/messages", messagesController.getMessages);
    router.get("/messages/:messId", messagesController.getMessageId);

    router.get("/webhook", chatBotController.getWebhook);

    router.post("/", chatBotController.postMessage);
    router.post("/webhook", chatBotController.postWebhook);

    return app.use("/", router);
};

module.exports = initWebRoutes;