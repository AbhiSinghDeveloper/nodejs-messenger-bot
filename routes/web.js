const express = require("express");
const chatController = require("../controllers/chatController");
const messagesController = require("../controllers/messageController");

let router = express.Router();

let initWebRoutes = async (app) => {
    router.get("/messages", messagesController.getMessages);
    router.get("/messages/:messId", messagesController.getMessageId);

    router.get("/webhook", chatController.getWebhook);

    router.post("/", chatController.postMessage);
    router.post("/webhook", chatController.postWebhook);

    return app.use("/", router);
};

module.exports = initWebRoutes;